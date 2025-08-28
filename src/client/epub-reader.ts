declare const ePub: any;

interface BookMetadata {
  title?: string;
}

interface Book {
  loaded: {
    metadata: Promise<void>;
  };
  packaging: {
    metadata: BookMetadata;
  };
  renderTo(element: string, options: {
    width: string;
    height: string;
    spread: string;
    minSpreadWidth: number;
  }): Rendition;
  getRange(cfi: string): Promise<Range>;
}

interface Rendition {
  display(target?: string): Promise<void>;
  resize(): void;
  prev(): void;
  next(): void;
  destroy(): void;
  on(event: string, handler: (event: any) => void): void;
  currentLocation(): any;
  themes: {
    fontSize(size: string): void;
    register(name: string, url?: string): void;
    select(name: string): void;
    default(rules: any): void;
  };
  getRange(cfi: string): Range;
  annotations: {
    highlight(cfi: string, data?: any, cb?: Function, className?: string, styles?: any): void;
    underline(cfi: string, data?: any, cb?: Function, className?: string, styles?: any): void;
    mark(cfi: string, data?: any, cb?: Function): void;
    remove(cfi: string, type?: string): void;
  };
}

class EpubReader extends HTMLElement {
  private book: Book | null = null;
  private rendition: Rendition | null = null;
  private fileId: string | null = null;
  private savePositionTimeout: NodeJS.Timeout | null = null;
  private currentFontSize: number = 100;
  private selectedText: string = '';
  private selectedCfi: string = '';

  constructor() {
    super();
    // Expose loadFromCfi as a public method for external access
    (this as any).loadFromCfi = this.loadFromCfi.bind(this);
  }

  connectedCallback(): void {
    this.fileId = this.getAttribute('file-id');
    this.innerHTML = `
      <div class="reader-header">
        <button class="reader-btn" id="back-btn">← Back to Library</button>
        <div class="reader-title">Loading...</div>
        <div class="reader-controls">
          <button class="reader-btn" id="decrease-font-btn">A-</button>
          <button class="reader-btn" id="increase-font-btn">A+</button>
          <span class="font-size-display" id="font-size-display">100%</span>
          <button class="reader-btn" id="prev-btn">Previous</button>
          <button class="reader-btn" id="next-btn">Next</button>
        </div>
      </div>
      <div class="reader-content" style="border: none; padding: 0; margin: 0; background: white;">
        <div id="epub-viewer" style="height: calc(100vh - 120px);"></div>
      </div>
      
      <!-- Note creation modal -->
      <div id="note-modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; background: white; border: 2px solid #111; padding: 20px; width: 90%; max-width: 600px; box-shadow: 5px 5px 0 #111;">
        <h3 style="margin-top: 0;">Create Note from Selection</h3>
        <div style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-left: 3px solid #111;">
          <blockquote id="selected-text-preview" style="margin: 0; font-style: italic;"></blockquote>
        </div>
        <textarea id="note-content" style="width: 100%; height: 200px; padding: 10px; border: 1px solid #111; font-family: monospace; resize: vertical;"></textarea>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="cancel-note-btn" style="padding: 8px 16px; background: #f5f5f5; border: 2px solid #111; cursor: pointer;">Cancel</button>
          <button id="save-note-btn" style="padding: 8px 16px; background: #111; color: white; border: 2px solid #111; cursor: pointer;">Create Note</button>
        </div>
      </div>
      <div id="note-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 999;"></div>
      
      <!-- Selection tooltip -->
      <div id="selection-tooltip" style="display: none; position: absolute; background: #111; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer; z-index: 998; font-size: 14px;">
        📝 Create Note
      </div>
    `;
    
    this.querySelector('#back-btn')!.addEventListener('click', () => this.goBack());
    this.querySelector('#prev-btn')!.addEventListener('click', () => this.prevPage());
    this.querySelector('#next-btn')!.addEventListener('click', () => this.nextPage());
    this.querySelector('#decrease-font-btn')!.addEventListener('click', () => this.decreaseFontSize());
    this.querySelector('#increase-font-btn')!.addEventListener('click', () => this.increaseFontSize());
    
    // Setup note modal handlers
    const overlay = this.querySelector('#note-modal-overlay')!;
    const cancelBtn = this.querySelector('#cancel-note-btn')!;
    const saveBtn = this.querySelector('#save-note-btn')!;
    const tooltip = this.querySelector('#selection-tooltip')!;
    
    cancelBtn.addEventListener('click', () => this.closeNoteModal());
    overlay.addEventListener('click', () => this.closeNoteModal());
    saveBtn.addEventListener('click', async () => {
      console.log('Save button clicked');
      await this.saveNote();
    });
    tooltip.addEventListener('click', () => this.openNoteModal());
    
    // Add keyboard shortcut for note creation (Ctrl/Cmd + K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && this.selectedText) {
        e.preventDefault();
        this.openNoteModal();
      }
    });
  }

  async loadBook(url: string): Promise<void> {
    try {
      if (this.rendition) {
        this.rendition.destroy();
      }
      
      console.log('Fetching EPUB from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch EPUB: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('EPUB blob size:', blob.size);
      
      this.book = ePub(blob);
      
      if (!this.book) {
        throw new Error('Failed to create book instance');
      }
      
      await this.book.loaded.metadata;
      const metadata = this.book.packaging.metadata;
      const titleElement = this.querySelector('.reader-title');
      if (titleElement) {
        titleElement.textContent = metadata.title || 'Untitled';
      }
      
      this.rendition = this.book.renderTo("epub-viewer", {
        width: "100%",
        height: "100%",
        spread: "always",
        minSpreadWidth: 800
      });
      
      // Load saved position and font size if exists
      if (this.fileId) {
        const position = await this.loadSavedPosition();
        if (position) {
          if (position.fontSize) {
            this.currentFontSize = position.fontSize;
            this.applyFontSize();
          }
          if (position.cfi) {
            await this.rendition.display(position.cfi);
          } else {
            await this.rendition.display();
          }
        } else {
          await this.rendition.display();
        }
      } else {
        await this.rendition.display();
      }
      
      // Set up position saving on location change
      this.rendition.on('relocated', () => {
        this.savePositionDebounced();
      });
      
      // Set up text selection handling
      this.setupSelectionHandling();
      
      // Apply custom styles for highlights
      this.rendition.themes.default({
        '::selection': {
          'background': 'rgba(255, 255, 0, 0.3)'
        },
        '.highlight-red': {
          'background-color': 'rgba(255, 0, 0, 0.3)',
          'border-bottom': '2px solid red'
        }
      });
      
      document.addEventListener('keyup', this.handleKeyboard.bind(this));
      
      window.addEventListener('resize', () => {
        this.rendition?.resize();
      });
      
      let touchStart: number | null = null;
      this.rendition.on('touchstart', (event: TouchEvent) => {
        if (event.changedTouches && event.changedTouches[0]) {
          touchStart = event.changedTouches[0].screenX;
        }
      });
      
      this.rendition.on('touchend', (event: TouchEvent) => {
        if (!touchStart || !event.changedTouches || !event.changedTouches[0]) return;
        const touchEnd = event.changedTouches[0].screenX;
        const diff = touchStart - touchEnd;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            this.nextPage();
          } else {
            this.prevPage();
          }
        }
        touchStart = null;
      });
      
    } catch (error) {
      console.error('Error loading EPUB:', error);
      alert('Failed to load EPUB file: ' + (error as Error).message);
    }
  }

  private handleKeyboard(e: KeyboardEvent): void {
    if (!this.rendition) return;
    
    if (e.key === 'ArrowLeft') {
      this.prevPage();
    } else if (e.key === 'ArrowRight') {
      this.nextPage();
    } else if (e.key === 'Escape') {
      this.goBack();
    }
  }

  private prevPage(): void {
    if (this.rendition) {
      this.rendition.prev();
      this.savePositionDebounced();
    }
  }

  private nextPage(): void {
    if (this.rendition) {
      this.rendition.next();
      this.savePositionDebounced();
    }
  }
  
  private async loadSavedPosition(): Promise<{ cfi: string | null; percentage: number; fontSize: number } | null> {
    if (!this.fileId) return null;
    
    try {
      const response = await fetch(`/api/reading-position/${this.fileId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to load reading position:', error);
    }
    return null;
  }
  
  private savePositionDebounced(): void {
    if (!this.fileId || !this.rendition) return;
    
    // Clear existing timeout
    if (this.savePositionTimeout) {
      clearTimeout(this.savePositionTimeout);
    }
    
    // Save position after 1 second of no activity
    this.savePositionTimeout = setTimeout(() => {
      this.savePosition();
    }, 1000);
  }
  
  private async savePosition(): Promise<void> {
    if (!this.fileId || !this.rendition) return;
    
    try {
      const location = this.rendition.currentLocation();
      if (!location || !location.start) return;
      
      const cfi = location.start.cfi;
      const percentage = location.start.percentage || 0;
      
      await fetch('/api/reading-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: this.fileId,
          cfi: cfi,
          percentage: Math.round(percentage * 100),
          fontSize: this.currentFontSize
        }),
      });
    } catch (error) {
      console.error('Failed to save reading position:', error);
    }
  }

  private increaseFontSize(): void {
    if (this.currentFontSize < 200) {
      this.currentFontSize += 10;
      this.applyFontSize();
      this.savePositionDebounced();
    }
  }
  
  private decreaseFontSize(): void {
    if (this.currentFontSize > 50) {
      this.currentFontSize -= 10;
      this.applyFontSize();
      this.savePositionDebounced();
    }
  }
  
  private applyFontSize(): void {
    if (this.rendition) {
      this.rendition.themes.fontSize(`${this.currentFontSize}%`);
      const display = this.querySelector('#font-size-display') as HTMLElement;
      if (display) {
        display.textContent = `${this.currentFontSize}%`;
      }
    }
  }
  
  
  private goBack(): void {
    // Save position before leaving
    this.savePosition();
    
    if (this.rendition) {
      this.rendition.destroy();
    }
    document.removeEventListener('keyup', this.handleKeyboard.bind(this));
    
    window.location.href = '/reader';
  }
  
  private setupSelectionHandling(): void {
    if (!this.rendition || !this.book) return;
    
    // Use the simpler selected event signature from epub.js examples
    // @ts-ignore - EPUB.js types don't match actual implementation
    this.rendition.on('selected', (cfiRange: string, contents: any) => {
      console.log('Text selected with CFI:', cfiRange);
      
      // Get selected text from contents window
      const selection = contents.window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const text = selection.toString().trim();
      if (!text) {
        console.log('No text selected');
        return;
      }
      
      console.log('Selected text:', text);
      this.selectedText = text;
      this.selectedCfi = cfiRange;
      
      // Show tooltip near selection
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const tooltip = this.querySelector('#selection-tooltip') as HTMLElement;
        
        if (tooltip) {
          // Get the iframe to calculate proper position
          const iframe = contents.document.defaultView.frameElement as HTMLIFrameElement;
          if (iframe) {
            const iframeRect = iframe.getBoundingClientRect();
            tooltip.style.display = 'block';
            tooltip.style.position = 'fixed';
            tooltip.style.left = `${iframeRect.left + rect.left + rect.width / 2 - 50}px`;
            tooltip.style.top = `${iframeRect.top + rect.top - 35}px`;
            tooltip.style.zIndex = '9999';
            console.log('Tooltip shown at:', tooltip.style.left, tooltip.style.top);
          }
        }
        
        // Optional: clear selection after showing tooltip
        // selection.removeAllRanges();
      } catch (error) {
        console.error('Error positioning tooltip:', error);
      }
    });
    
    // Handle deselection
    document.addEventListener('click', (e) => {
      const tooltip = this.querySelector('#selection-tooltip') as HTMLElement;
      const modal = this.querySelector('#note-modal') as HTMLElement;
      
      // Don't hide if clicking on tooltip or modal
      if (tooltip && !tooltip.contains(e.target as Node) && 
          modal && !modal.contains(e.target as Node) && 
          modal.style.display === 'none') {
        tooltip.style.display = 'none';
        this.selectedText = '';
        this.selectedCfi = '';
      }
    });
  }
  
  private openNoteModal(): void {
    if (!this.selectedText || !this.selectedCfi) return;
    
    const modal = this.querySelector('#note-modal') as HTMLElement;
    const overlay = this.querySelector('#note-modal-overlay') as HTMLElement;
    const preview = this.querySelector('#selected-text-preview') as HTMLElement;
    const textarea = this.querySelector('#note-content') as HTMLTextAreaElement;
    const tooltip = this.querySelector('#selection-tooltip') as HTMLElement;
    
    // Hide tooltip
    if (tooltip) {
      tooltip.style.display = 'none';
    }
    
    // Set up modal content
    preview.textContent = this.selectedText;
    
    // Create the formatted note content with CFI link
    const cfiLink = `${this.fileId}.epub#${encodeURIComponent(this.selectedCfi)}`;
    const noteContent = `> [${this.selectedText}](${cfiLink})\n\n`;
    textarea.value = noteContent;
    
    // Position cursor at the end for additional notes
    textarea.setSelectionRange(noteContent.length, noteContent.length);
    
    // Show modal
    modal.style.display = 'block';
    overlay.style.display = 'block';
    textarea.focus();
  }
  
  private closeNoteModal(): void {
    const modal = this.querySelector('#note-modal') as HTMLElement;
    const overlay = this.querySelector('#note-modal-overlay') as HTMLElement;
    
    modal.style.display = 'none';
    overlay.style.display = 'none';
  }
  
  private async saveNote(): Promise<void> {
    console.log('saveNote() called');
    const textarea = this.querySelector('#note-content') as HTMLTextAreaElement;
    
    if (!textarea) {
      console.error('Note content textarea not found');
      alert('Error: Could not find note content field');
      return;
    }
    
    const content = textarea.value.trim();
    console.log('Note content:', content);
    
    if (!content) {
      console.log('No content, returning');
      return;
    }
    
    try {
      // Create the note
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (response.ok) {
        let noteId: string | undefined;
        try {
          const data = await response.json();
          noteId = data.id;
          console.log('Note created with ID:', noteId);
        } catch (jsonError) {
          console.error('Error parsing response:', jsonError);
          // Can't read response body twice - it was already consumed
          console.error('JSON parse error details:', jsonError);
        }
        
        // Close the modal and continue reading
        this.closeNoteModal();
        
        // Clear the selection in the EPUB
        // Note: clearSelection might not exist, just ignore if it fails
        
        // Show a clickable success message (if we have the note ID)
        const successMsg = document.createElement('a') as HTMLAnchorElement;
        if (noteId) {
          successMsg.href = `/note/${noteId}`;
          successMsg.textContent = 'Note created successfully (click to view)';
        } else {
          successMsg.href = '#';
          successMsg.textContent = 'Note created successfully';
          successMsg.onclick = (e) => e.preventDefault();
        }
        successMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #111;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 10000;
          animation: fadeIn 0.3s ease-in;
          text-decoration: none;
          cursor: pointer;
          display: block;
          box-shadow: 2px 2px 0 rgba(0,0,0,0.3);
          transition: transform 0.2s ease;
        `;
        
        // Add hover effect
        successMsg.onmouseenter = () => {
          successMsg.style.transform = 'scale(1.05)';
        };
        successMsg.onmouseleave = () => {
          successMsg.style.transform = 'scale(1)';
        };
        
        // Open in new tab with middle click or ctrl/cmd+click
        if (noteId) {
          successMsg.onclick = (e) => {
            if (e.ctrlKey || e.metaKey || e.button === 1) {
              window.open(`/note/${noteId}`, '_blank');
              e.preventDefault();
            }
          };
        }
        
        document.body.appendChild(successMsg);
        
        // Remove the message after 5 seconds (longer since it's interactive)
        setTimeout(() => {
          successMsg.remove();
        }, 5000);
        
      } else {
        console.error('Response not ok:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        alert('Failed to create note: ' + response.statusText);
      }
    } catch (error) {
      console.error('Error creating note - Full error object:', error);
      console.error('Error stack:', (error as any).stack);
      console.error('Error message:', (error as any).message);
      // Don't show alert if the note was actually created successfully
      // Check if this is just a JSON parsing error after successful creation
      if (error instanceof TypeError && (error as any).message?.includes('Body has already been read')) {
        console.log('Note was created but there was an issue reading the response');
        // Still show success message (but without link since we don't have the ID)
        this.closeNoteModal();
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Note created successfully';
        successMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #111;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 10000;
          cursor: default;
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else {
        alert('Failed to create note: ' + (error as any).message);
      }
    }
  }
  
  async loadFromCfi(cfi: string): Promise<void> {
    if (!this.rendition || !cfi) return;
    
    try {
      // Display the CFI location
      await this.rendition.display(decodeURIComponent(cfi));
      
      // Highlight the text at this CFI
      setTimeout(() => {
        if (this.rendition) {
          this.rendition.annotations.highlight(
            decodeURIComponent(cfi),
            {},
            () => {},
            'highlight-red',
            {}
          );
        }
      }, 500);
    } catch (error) {
      console.error('Error loading CFI:', error);
    }
  }
}

customElements.define('epub-reader', EpubReader);