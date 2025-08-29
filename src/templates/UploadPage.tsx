import { Layout } from "./Layout";
import { Nav } from "./Nav";

export const UploadPage = () => (
  <Layout title="Upload File - Slipbox">
    <div id="app" class="container">
      <Nav currentPage="upload" />

      <main>
        <h2>Upload File</h2>
        <form
          method="POST"
          action="/api/files/upload"
          enctype="multipart/form-data"
          style="margin-top: 2rem;"
        >
          <div style="margin-bottom: 1rem;">
            <label for="file" style="display: block; margin-bottom: 0.5rem;">
              Select file to upload:
            </label>
            <input type="file" id="file" name="file" required style="font-size: 1rem;" />
          </div>

          <div style="margin-bottom: 1rem;">
            <label for="noteId" style="display: block; margin-bottom: 0.5rem;">
              Note ID (optional):
            </label>
            <input
              type="text"
              id="noteId"
              name="noteId"
              placeholder="e.g., abc123.md"
              style="width: 100%; padding: 0.5rem; font-size: 1rem; border: 1px solid #111;"
            />
          </div>

          <button
            type="submit"
            style="padding: 0.5rem 1rem; font-size: 1rem; background: #111; color: white; border: none; cursor: pointer;"
          >
            Upload File
          </button>
        </form>
      </main>
    </div>
  </Layout>
);
