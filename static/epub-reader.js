"use strict";
class EpubReader extends HTMLElement {
    book = null;
    rendition = null;
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = `
      <div class="reader-header">
        <button class="reader-btn" id="back-btn">← Back to Library</button>
        <div class="reader-title">Loading...</div>
        <div class="reader-controls">
          <button class="reader-btn" id="prev-btn">Previous</button>
          <button class="reader-btn" id="next-btn">Next</button>
        </div>
      </div>
      <div class="reader-content">
        <div id="epub-viewer"></div>
      </div>
    `;
        this.querySelector('#back-btn').addEventListener('click', () => this.goBack());
        this.querySelector('#prev-btn').addEventListener('click', () => this.prevPage());
        this.querySelector('#next-btn').addEventListener('click', () => this.nextPage());
    }
    async loadBook(url) {
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
            await this.book.loaded.metadata;
            const metadata = this.book.packaging.metadata;
            this.querySelector('.reader-title').textContent = metadata.title || 'Untitled';
            this.rendition = this.book.renderTo("epub-viewer", {
                width: "100%",
                height: "100%",
                spread: "always",
                minSpreadWidth: 800
            });
            await this.rendition.display();
            document.addEventListener('keyup', this.handleKeyboard.bind(this));
            window.addEventListener('resize', () => {
                this.rendition?.resize();
            });
            let touchStart = null;
            this.rendition.on('touchstart', (event) => {
                if (event.changedTouches && event.changedTouches[0]) {
                    touchStart = event.changedTouches[0].screenX;
                }
            });
            this.rendition.on('touchend', (event) => {
                if (!touchStart || !event.changedTouches || !event.changedTouches[0])
                    return;
                const touchEnd = event.changedTouches[0].screenX;
                const diff = touchStart - touchEnd;
                if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                        this.nextPage();
                    }
                    else {
                        this.prevPage();
                    }
                }
                touchStart = null;
            });
        }
        catch (error) {
            console.error('Error loading EPUB:', error);
            alert('Failed to load EPUB file: ' + error.message);
        }
    }
    handleKeyboard(e) {
        if (!this.rendition)
            return;
        if (e.key === 'ArrowLeft') {
            this.prevPage();
        }
        else if (e.key === 'ArrowRight') {
            this.nextPage();
        }
        else if (e.key === 'Escape') {
            this.goBack();
        }
    }
    prevPage() {
        if (this.rendition) {
            this.rendition.prev();
        }
    }
    nextPage() {
        if (this.rendition) {
            this.rendition.next();
        }
    }
    goBack() {
        if (this.rendition) {
            this.rendition.destroy();
        }
        document.removeEventListener('keyup', this.handleKeyboard.bind(this));
        window.location.href = '/reader';
    }
}
customElements.define('epub-reader', EpubReader);
//# sourceMappingURL=epub-reader.js.map