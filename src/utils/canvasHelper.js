import templateImg from '../assets/template 1.jpg'; // Ensure extension matches your file

/**
 * Advanced Canvas Utility: 
 * 1. Loads the Certificate Template
 * 2. Writes the Student Name on the line
 * 3. Places the QR Code as a 'Security Seal'
 */
export const generateDiploma = async (svgId, studentName = "John Doe", fileName = 'Diploma') => {
    const svg = document.getElementById(svgId);
    if (!svg) {
        console.error("QR Code SVG not found.");
        return;
    }

    // 1. Prepare QR Code Image
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const qrUrl = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const baseTemplate = new Image();
        const qrImage = new Image();

        baseTemplate.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Match canvas to high-res template size
            canvas.width = baseTemplate.width;
            canvas.height = baseTemplate.height;

            // Draw Background Template
            ctx.drawImage(baseTemplate, 0, 0);

            // --- 2. ADD STUDENT NAME ---
            // Positioned roughly in the center above the line
            ctx.font = "bold 80px sans-serif"; // Adjust font size as needed
            ctx.fillStyle = "#1a3a3a"; // Dark green/black to match your template
            ctx.textAlign = "center";
            ctx.fillText(studentName.toUpperCase(), canvas.width / 2, canvas.height / 2 + 50);

            // --- 3. ADD QR CODE SEAL ---
            qrImage.onload = () => {
                const qrSize = 280; // Size of the seal
                // Positioning it bottom-right, but inside the border
                const x = canvas.width - qrSize - 150;
                const y = canvas.height - qrSize - 150;

                // Draw a small white backing for the QR code for better scanning
                ctx.fillStyle = "white";
                ctx.fillRect(x - 10, y - 10, qrSize + 20, qrSize + 20);

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(qrImage, x, y, qrSize, qrSize);

                // --- 4. DOWNLOAD ---
                const pngUrl = canvas.toDataURL("image/jpeg", 0.9);
                const downloadLink = document.createElement("a");
                downloadLink.href = pngUrl;
                downloadLink.download = `${fileName.replace(/\s+/g, '_')}.jpg`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                URL.revokeObjectURL(qrUrl);
                resolve(true);
            };
            qrImage.src = qrUrl;
        };

        baseTemplate.onerror = () => reject("Template image failed to load.");
        baseTemplate.src = templateImg;
    });
};

// Keep your alias for the dashboard
export const downloadAsImage = generateDiploma;

/**
 * Utility to shorten hashes for UI
 */
export const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
};