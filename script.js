// Global variables
let allPages = [];
let selectedPages = [];
let nextId = 0;
let currentPreviewIndex = 0;

// DOM elements
const uploadSection = document.getElementById('upload-section');
const workspaceSection = document.getElementById('workspace-section');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const allPagesGrid = document.getElementById('allPagesGrid');
const selectedGrid = document.getElementById('selectedGrid');
const pageCountSpan = document.getElementById('pageCount');
const previewBtn = document.getElementById('previewBtn');
const modal = document.getElementById('previewModal');
const aboutModal = document.getElementById('aboutModal');
const previewCanvas = document.getElementById('previewCanvas');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageIndicatorSpan = document.getElementById('pageIndicator');
const totalPagesSpan = document.getElementById('totalPages');
const mergeBtn = document.getElementById('mergeBtn');

// Initialize event listeners
function init() {
    browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();  // Add this to prevent bubbling
    fileInput.click();
    });

    // Back to Home button
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => {
        // Reset all state
        allPages = [];
        selectedPages = [];
        allPagesGrid.innerHTML = '';
        selectedGrid.innerHTML = '';
        
        // Switch back to upload section
        workspaceSection.classList.remove('active');
        uploadSection.classList.add('active');
        
        // Reset file input
        fileInput.value = '';
        
        // Clear any stored data
        nextId = 0;
        previewBtn.disabled = true;
    });
    }

    dropZone.style.cursor = 'default';  // Add this line after dropZone references
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f3e8ff';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#faf5ff';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#faf5ff';
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
        fileInput.value = '';
    });
    
    document.getElementById('selectAllBtn').addEventListener('click', selectAllPages);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAllPages);
    
    previewBtn.addEventListener('click', openPreview);
    mergeBtn.addEventListener('click', mergeAndDownload);
    
    document.getElementById('closeModal').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    document.getElementById('cancelModal').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    prevPageBtn.addEventListener('click', previousPage);
    nextPageBtn.addEventListener('click', nextPage);
    
    document.getElementById('aboutLink').addEventListener('click', (e) => {
        e.preventDefault();
        aboutModal.classList.add('show');
    });
    document.getElementById('closeAboutModal').addEventListener('click', () => {
        aboutModal.classList.remove('show');
    });
    document.getElementById('privacyLink').addEventListener('click', (e) => {
        e.preventDefault();
        alert('🔒 All processing happens in your browser. No files are ever uploaded to any server.');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
        if (e.target === aboutModal) aboutModal.classList.remove('show');
    });
}

// Handle uploaded files
async function handleFiles(files) {
    const validFiles = files.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (validFiles.length === 0) return;
    
    allPages = [];
    selectedPages = [];
    allPagesGrid.innerHTML = '';
    selectedGrid.innerHTML = '';
    nextId = 0;
    
    for (const file of validFiles) {
        if (file.type === 'application/pdf') {
            await processPDF(file);
        } else if (file.type.startsWith('image/')) {
            await processImage(file);
        }
    }
    
    pageCountSpan.textContent = `${allPages.length} page${allPages.length !== 1 ? 's' : ''}`;
    uploadSection.classList.remove('active');
    workspaceSection.classList.add('active');
    previewBtn.disabled = true;
}

// Process PDF files
async function processPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        const thumb = createThumbnail(nextId, canvas, `${file.name} - p.${i}`);
        allPagesGrid.appendChild(thumb);
        
        allPages.push({
            id: nextId++,
            pdfBytes: arrayBuffer,
            pageIndex: i,
            thumbElement: thumb,
            selectedOrder: null,
            selectedElement: null
        });
    }
}

// Process image files
async function processImage(file) {
    const imageData = await convertImageToPDF(file);
    const img = new Image();
    const thumbCanvas = document.createElement('canvas');
    
    await new Promise((resolve) => {
        img.onload = () => {
            const maxWidth = 100;
            const scale = maxWidth / img.width;
            thumbCanvas.width = maxWidth;
            thumbCanvas.height = img.height * scale;
            thumbCanvas.getContext('2d').drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
            URL.revokeObjectURL(img.src);
            resolve();
        };
        img.src = URL.createObjectURL(file);
    });
    
    const thumb = createThumbnail(nextId, thumbCanvas, file.name);
    allPagesGrid.appendChild(thumb);
    
    allPages.push({
        id: nextId++,
        pdfBytes: imageData,
        pageIndex: 1,
        thumbElement: thumb,
        selectedOrder: null,
        selectedElement: null
    });
}

// Convert image to PDF
async function convertImageToPDF(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imgData = e.target.result;
            const img = new Image();
            img.onload = async function() {
                const pdfDoc = await PDFLib.PDFDocument.create();
                let image;
                
                if (file.type === 'image/jpeg') {
                    image = await pdfDoc.embedJpg(imgData);
                } else {
                    image = await pdfDoc.embedPng(imgData);
                }
                
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                const pdfBytes = await pdfDoc.save();
                resolve(pdfBytes);
            };
            img.src = imgData;
        };
        reader.readAsDataURL(file);
    });
}

// Create thumbnail element
function createThumbnail(id, canvas, label) {
    const div = document.createElement('div');
    div.className = 'thumbnail';
    div.dataset.id = id;
    div.appendChild(canvas);
    const span = document.createElement('span');
    span.textContent = label;
    div.appendChild(span);
    
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePageSelection(id);
    });
    
    return div;
}

// Toggle page selection
function togglePageSelection(id) {
    const page = allPages.find(p => p.id === id);
    if (!page) return;
    
    if (page.selectedOrder === null) {
        // Select page
        page.selectedOrder = selectedPages.length + 1;
        selectedPages.push(page);
        
        // Add badge to original thumbnail
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = page.selectedOrder;
        page.thumbElement.appendChild(badge);
        
        // Create selected thumbnail
        const selectedThumb = page.thumbElement.cloneNode(true);
        selectedThumb.classList.add('selected');
        selectedThumb.dataset.id = id;
        
        // Update badge
        const oldBadge = selectedThumb.querySelector('.badge');
        if (oldBadge) oldBadge.remove();
        const newBadge = document.createElement('div');
        newBadge.className = 'badge';
        newBadge.textContent = page.selectedOrder;
        selectedThumb.appendChild(newBadge);
        
        selectedThumb.addEventListener('click', (e) => e.stopPropagation());
        selectedGrid.appendChild(selectedThumb);
        page.selectedElement = selectedThumb;
        
        renumberPages();
    } else {
        // Deselect page
        const index = selectedPages.findIndex(p => p.id === id);
        if (index !== -1) selectedPages.splice(index, 1);
        
        const badge = page.thumbElement.querySelector('.badge');
        if (badge) badge.remove();
        
        if (page.selectedElement) page.selectedElement.remove();
        page.selectedElement = null;
        page.selectedOrder = null;
        
        renumberPages();
    }
    
    previewBtn.disabled = selectedPages.length === 0;
}

// Renumber all selected pages
function renumberPages() {
    selectedPages.forEach((page, idx) => {
        const newNumber = idx + 1;
        page.selectedOrder = newNumber;
        
        const badge1 = page.thumbElement.querySelector('.badge');
        if (badge1) badge1.textContent = newNumber;
        
        if (page.selectedElement) {
            const badge2 = page.selectedElement.querySelector('.badge');
            if (badge2) badge2.textContent = newNumber;
        }
    });
}

// Select all pages
function selectAllPages() {
    const unselected = allPages.filter(p => p.selectedOrder === null);
    unselected.forEach(page => {
        page.selectedOrder = selectedPages.length + 1;
        selectedPages.push(page);
        
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = page.selectedOrder;
        page.thumbElement.appendChild(badge);
        
        const selectedThumb = page.thumbElement.cloneNode(true);
        selectedThumb.classList.add('selected');
        const oldBadge = selectedThumb.querySelector('.badge');
        if (oldBadge) oldBadge.remove();
        const newBadge = document.createElement('div');
        newBadge.className = 'badge';
        newBadge.textContent = page.selectedOrder;
        selectedThumb.appendChild(newBadge);
        selectedThumb.addEventListener('click', (e) => e.stopPropagation());
        
        selectedGrid.appendChild(selectedThumb);
        page.selectedElement = selectedThumb;
    });
    
    renumberPages();
    previewBtn.disabled = selectedPages.length === 0;
}

// Deselect all pages
function deselectAllPages() {
    selectedPages.forEach(page => {
        const badge = page.thumbElement.querySelector('.badge');
        if (badge) badge.remove();
        if (page.selectedElement) page.selectedElement.remove();
        page.selectedElement = null;
        page.selectedOrder = null;
    });
    selectedPages = [];
    previewBtn.disabled = true;
}

// Initialize Sortable for reordering
new Sortable(selectedGrid, {
    animation: 200,
    onEnd: function() {
        const newOrder = [];
        const elements = Array.from(selectedGrid.children);
        elements.forEach(el => {
            const id = parseInt(el.dataset.id);
            const page = allPages.find(p => p.id === id);
            if (page) newOrder.push(page);
        });
        selectedPages = newOrder;
        renumberPages();
    }
});

// Open preview modal
async function openPreview() {
    if (selectedPages.length === 0) return;
    currentPreviewIndex = 0;
    totalPagesSpan.textContent = selectedPages.length;
    await renderPreviewPage(0);
    modal.classList.add('show');
}

// Render preview page
async function renderPreviewPage(index) {
    const page = selectedPages[index];
    if (!page) return;
    
    const pdf = await pdfjsLib.getDocument({ data: page.pdfBytes }).promise;
    const pdfPage = await pdf.getPage(page.pageIndex);
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    
    previewCanvas.width = viewport.width;
    previewCanvas.height = viewport.height;
    await pdfPage.render({ canvasContext: previewCanvas.getContext('2d'), viewport }).promise;
    
    pageIndicatorSpan.textContent = `Page ${index + 1} of ${selectedPages.length}`;
    prevPageBtn.disabled = index === 0;
    nextPageBtn.disabled = index === selectedPages.length - 1;
}

// Navigation functions
function previousPage() {
    if (currentPreviewIndex > 0) {
        currentPreviewIndex--;
        renderPreviewPage(currentPreviewIndex);
    }
}

function nextPage() {
    if (currentPreviewIndex < selectedPages.length - 1) {
        currentPreviewIndex++;
        renderPreviewPage(currentPreviewIndex);
    }
}

// Merge and download
async function mergeAndDownload() {
    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Merging...';
    
    const mergedPdf = await PDFLib.PDFDocument.create();
    
    for (const page of selectedPages) {
        const sourcePdf = await PDFLib.PDFDocument.load(page.pdfBytes);
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.pageIndex - 1]);
        mergedPdf.addPage(copiedPage);
    }
    
    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'merged_document.pdf';
    link.click();
    URL.revokeObjectURL(link.href);
    
    mergeBtn.disabled = false;
    mergeBtn.textContent = 'Merge & Download';
    modal.classList.remove('show');
}

// Start the app
init();