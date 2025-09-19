const logDiv = document.getElementById("log");
const seenFiles = {}; // filename -> content

function urlToFilename(url) {
    // Create a safe and unique filename from the URL
    const base = url.hostname + url.pathname.replace(/[\/\\?%*:|"<>]/g, "_");
    return base || "file";
}

function hasAllowedExtension(url) {
    const input = document.getElementById("allowedExt");
    if (!input) return false;
    const allowedExtensions = input.value
        .split(",")
        .map(ext => ext.trim())
        .filter(ext => ext !== "");
    return allowedExtensions.some(ext => url.pathname.endsWith(ext));
}

window.onload = () => {
    chrome.devtools.inspectedWindow.eval("window.location.hostname", (result, isException) => {
        if (isException || !result) {
            console.error("Failed to get hostname of inspected window.");
            return;
        }

        window.currentPageDomain = result;

        // Start listening after domain is known
        chrome.devtools.network.onRequestFinished.addListener((request) => {
            try {
                const url = new URL(request.request.url);

                if (url.hostname !== window.currentPageDomain) return;
                if (!hasAllowedExtension(url)) return;

                const filename = urlToFilename(url);
                if (seenFiles[filename]) return; // Skip duplicates

                request.getContent((body, encoding) => {
                    if (!body) return; // Skip if no content
                    const decoded = encoding === "base64" ? atob(body) : body;
                    seenFiles[filename] = decoded;

                    const div = document.createElement("div");
                    div.className = "url";
                    div.textContent = url.href;
                    logDiv.appendChild(div);
                });

            } catch (err) {
                console.error("Failed to handle request:", request.request.url, err);
            }
        });
    });

    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            Object.keys(seenFiles).forEach(k => delete seenFiles[k]);
            logDiv.innerHTML = "";
        });
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", async () => {
            const zip = new JSZip();

            Object.entries(seenFiles).forEach(([filename, content]) => {
                zip.file(filename, content);
            });

            try {
                const zipBlob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "responses.zip";
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (e) {
                console.error("Error generating ZIP:", e);
            }
        });
    }
};
