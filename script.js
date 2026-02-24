// ========== GLOBAL STATE ==========
let pages = [];               // { id, file, pageIndex, pdfBytes, allThumbEl, selectedThumbEl, selectedOrder }
let selectedPages = [];       // ordered array of page objects
let nextId = 0;

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
const previewGrid = document.getElementById('previewGrid');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const mergeBtn = document.getElementById('mergeBtn');

// ==========preview part ========
let currentPreviewIndex = 0;
let previewCanvas = document.getElementById('previewCanvas');
let prevPageBtn = document.getElementById('prevPageBtn');
let nextPageBtn = document.getElementById('nextPageBtn');
let pageIndicatorSpan = document.getElementById('pageIndicator');
let totalPagesSpan = document.getElementById('totalPages');

// ========== INIT ==========
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);

// ========== HANDLE UPLOAD ==========
async function handleDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length) await loadPDFs(files);
}

async function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (files.length) await loadPDFs(files);
}

async function loadPDFs(files) {
    // Clear previous state
    pages = [];
    selectedPages = [];
    allPagesGrid.innerHTML = '';
    selectedGrid.innerHTML = '';
    nextId = 0;
    
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.25 }); // thumbnail size
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({ canvasContext: context, viewport }).promise;
            
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'thumbnail';
            thumbDiv.dataset.id = nextId;
            thumbDiv.appendChild(canvas);
            
            const span = document.createElement('span');
            span.textContent = `${file.name} - p.${i}`;
            thumbDiv.appendChild(span);
            
            allPagesGrid.appendChild(thumbDiv);
            
            pages.push({
                id: nextId++,
                file,
                pageIndex: i,
                pdfBytes: arrayBuffer,
                allThumbEl: thumbDiv,
                selectedThumbEl: null,
                selectedOrder: null
            });
        }
    }
    
    // Add click listener to all thumbnails (event delegation)
    allPagesGrid.addEventListener('click', onAllPagesClick);
    
    // Update page count
    pageCountSpan.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''}`;
    
    // Switch to workspace
    uploadSection.classList.remove('active');
    workspaceSection.classList.add('active');
    previewBtn.disabled = true;
}

// ========== SELECTION TOGGLE ==========
function onAllPagesClick(e) {
    const thumb = e.target.closest('.thumbnail');
    if (!thumb) return;
    const id = parseInt(thumb.dataset.id);
    const page = pages.find(p => p.id === id);
    if (!page) return;
    
    if (page.selectedOrder === null) {
        // SELECT
        page.selectedOrder = selectedPages.length + 1; // temporary, will renumber
        selectedPages.push(page);
        
        // Add badge to all-pages thumbnail
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = page.selectedOrder;
        badge.dataset.forPage = id;
        thumb.appendChild(badge);
        
        // Create selected thumbnail (clone)
        const selectedThumb = thumb.cloneNode(true);
        selectedThumb.classList.add('selected');
        selectedThumb.dataset.id = id;
        // Remove old badge if any (will be recreated)
        const oldBadge = selectedThumb.querySelector('.badge');
        if (oldBadge) oldBadge.remove();
        // Add fresh badge
        const newBadge = document.createElement('div');
        newBadge.className = 'badge';
        newBadge.textContent = page.selectedOrder;
        selectedThumb.appendChild(newBadge);
        
        // Adjust click behaviour on selected thumb (do nothing on click, but keep for sortable)
        selectedThumb.style.cursor = 'grab';
        selectedThumb.addEventListener('click', (e) => e.stopPropagation()); // prevent toggling from selected grid
        
        selectedGrid.appendChild(selectedThumb);
        page.selectedThumbEl = selectedThumb;
        
        // Renumber all after change
        renumberAll();
    } else {
        // DESELECT
        const index = selectedPages.findIndex(p => p.id === id);
        if (index !== -1) selectedPages.splice(index, 1);
        
        // Remove badge from all-pages thumbnail
        const badge = thumb.querySelector('.badge');
        if (badge) badge.remove();
        
        // Remove selected thumbnail
        if (page.selectedThumbEl) page.selectedThumbEl.remove();
        page.selectedThumbEl = null;
        page.selectedOrder = null;
        
        // Renumber all
        renumberAll();
    }
    
    // Enable preview if at least one page selected
    previewBtn.disabled = selectedPages.length === 0;
}

// ========== RENUMBER BADGES (after add/remove/reorder) ==========
function renumberAll() {
    selectedPages.forEach((page, idx) => {
        const newNumber = idx + 1;
        page.selectedOrder = newNumber;
        
        // Update badge on all-pages thumbnail
        const allBadge = page.allThumbEl.querySelector('.badge');
        if (allBadge) allBadge.textContent = newNumber;
        
        // Update badge on selected thumbnail
        if (page.selectedThumbEl) {
            const selBadge = page.selectedThumbEl.querySelector('.badge');
            if (selBadge) selBadge.textContent = newNumber;
        }
    });
}

// ========== SORTABLE FOR SELECTED GRID ==========
let sortable = new Sortable(selectedGrid, {
    animation: 200,
    onEnd: function() {
        // Reorder selectedPages array based on DOM order
        const newSelected = [];
        const children = Array.from(selectedGrid.children);
        children.forEach(child => {
            const id = parseInt(child.dataset.id);
            const page = pages.find(p => p.id === id);
            if (page) newSelected.push(page);
        });
        selectedPages = newSelected;
        renumberAll();
    }
});

// ========== PREVIEW MODAL ==========
previewBtn.addEventListener('click', () => {
    // Fill preview grid with selected thumbnails (clone again or just show selected thumbs)
    previewGrid.innerHTML = '';
    selectedPages.forEach(page => {
        const clone = page.allThumbEl.cloneNode(true);
        // Keep badge
        clone.style.cursor = 'default';
        clone.classList.add('selected');
        previewGrid.appendChild(clone);
    });
    modal.classList.add('show');
});

closeModal.addEventListener('click', () => modal.classList.remove('show'));
cancelModal.addEventListener('click', () => modal.classList.remove('show'));
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
});

// ========== MERGE & DOWNLOAD ==========
mergeBtn.addEventListener('click', async () => {
    mergeBtn.disabled = true;
    mergeBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Merging...';
    
    const mergedPdf = await PDFLib.PDFDocument.create();
    
    for (const page of selectedPages) {
        const sourcePdf = await PDFLib.PDFDocument.load(page.pdfBytes);
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.pageIndex - 1]);
        mergedPdf.addPage(copiedPage);
    }
    
    const pdfBytes = await mergedPdf.save();
    download(pdfBytes, 'merged.pdf');
    
    mergeBtn.disabled = false;
    mergeBtn.innerHTML = '<i class="fas fa-download"></i> Merge & Download';
    modal.classList.remove('show');
});

function download(data, filename) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Select All button
document.getElementById('selectAllBtn').addEventListener('click', () => {
    const unselectedPages = pages.filter(p => p.selectedOrder === null);
    if (unselectedPages.length === 0) return; // all already selected
    
    // Append them in the order they appear in the all-pages grid
    const allThumbs = Array.from(allPagesGrid.children);
    const orderedUnselected = allThumbs
        .map(thumb => pages.find(p => p.id === parseInt(thumb.dataset.id)))
        .filter(p => p && p.selectedOrder === null);
    
    orderedUnselected.forEach(page => {
        // Mark as selected
        page.selectedOrder = selectedPages.length + 1; // temporary, will renumber
        selectedPages.push(page);
        
        // Add badge to all-pages thumbnail
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = page.selectedOrder;
        page.allThumbEl.appendChild(badge);
        
        // Create selected thumbnail
        const selectedThumb = page.allThumbEl.cloneNode(true);
        selectedThumb.classList.add('selected');
        selectedThumb.dataset.id = page.id;
        // Remove old badge if any (shouldn't exist) and add fresh one
        const oldBadge = selectedThumb.querySelector('.badge');
        if (oldBadge) oldBadge.remove();
        const newBadge = document.createElement('div');
        newBadge.className = 'badge';
        newBadge.textContent = page.selectedOrder;
        selectedThumb.appendChild(newBadge);
        selectedThumb.style.cursor = 'grab';
        selectedThumb.addEventListener('click', (e) => e.stopPropagation());
        
        selectedGrid.appendChild(selectedThumb);
        page.selectedThumbEl = selectedThumb;
    });
    
    renumberAll();
    previewBtn.disabled = selectedPages.length === 0;
});

// Deselect All button
document.getElementById('deselectAllBtn').addEventListener('click', () => {
    if (selectedPages.length === 0) return;
    
    // Remove all selected pages
    selectedPages.forEach(page => {
        // Remove badge from all-pages thumbnail
        const badge = page.allThumbEl.querySelector('.badge');
        if (badge) badge.remove();
        
        // Remove selected thumbnail
        if (page.selectedThumbEl) page.selectedThumbEl.remove();
        page.selectedThumbEl = null;
        page.selectedOrder = null;
    });
    
    selectedPages = [];
    renumberAll(); // clears any remaining numbers
    previewBtn.disabled = true;
});
async function renderPreviewPage(index) {
    if (!selectedPages.length) return;
    const pageInfo = selectedPages[index];
    if (!pageInfo) return;
    
    // Load the PDF page
    const loadingTask = pdfjsLib.getDocument({ data: pageInfo.pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageInfo.pageIndex);
    
    // Set canvas size based on viewport (scale for readability)
    const viewport = page.getViewport({ scale: 1.5 }); // adjust scale as needed
    const canvas = previewCanvas;
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    // Update indicator
    pageIndicatorSpan.textContent = `Page ${index + 1} of ${selectedPages.length}`;
    
    // Enable/disable nav buttons
    prevPageBtn.disabled = index === 0;
    nextPageBtn.disabled = index === selectedPages.length - 1;
}

prevPageBtn.addEventListener('click', async () => {
    if (currentPreviewIndex > 0) {
        currentPreviewIndex--;
        await renderPreviewPage(currentPreviewIndex);
    }
});

nextPageBtn.addEventListener('click', async () => {
    if (currentPreviewIndex < selectedPages.length - 1) {
        currentPreviewIndex++;
        await renderPreviewPage(currentPreviewIndex);
    }
});

closeModal.addEventListener('click', () => {
    modal.classList.remove('show');
    previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
});
// similarly for cancelModal and window click