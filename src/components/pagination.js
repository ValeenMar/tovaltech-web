// File: /src/components/pagination.js
// Sistema de paginación para catálogo

export function createPagination(totalItems, itemsPerPage = 50, currentPage = 1) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) {
    return {
      html: '',
      currentPage: 1,
      totalPages: 1,
      start: 0,
      end: totalItems
    };
  }
  
  const start = (currentPage - 1) * itemsPerPage;
  const end = Math.min(start + itemsPerPage, totalItems);
  
  // Calcular páginas a mostrar (máximo 7 botones)
  let pages = [];
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    if (currentPage <= 4) {
      pages = [1, 2, 3, 4, 5, '...', totalPages];
    } else if (currentPage >= totalPages - 3) {
      pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }
  }
  
  const html = `
    <div class="pagination">
      <button class="paginationBtn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>
        ← Anterior
      </button>
      
      ${pages.map(page => {
        if (page === '...') {
          return `<span class="paginationDots">...</span>`;
        }
        return `
          <button class="paginationBtn ${page === currentPage ? 'active' : ''}" 
                  data-page="${page}">
            ${page}
          </button>
        `;
      }).join('')}
      
      <button class="paginationBtn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>
        Siguiente →
      </button>
    </div>
    
    <div class="paginationInfo">
      Mostrando ${start + 1}-${end} de ${totalItems} productos
    </div>
  `;
  
  return {
    html,
    currentPage,
    totalPages,
    start,
    end
  };
}

export function wirePagination(container, onPageChange) {
  if (!container) return;
  
  const buttons = container.querySelectorAll('.paginationBtn:not([disabled])');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (page && onPageChange) {
        onPageChange(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}
