// zoom.js - Image Zoom and Lightbox functionality

function initImageZoom(imageElement, containerElement) {
  if (!imageElement || !containerElement) return;

  // Desktop Hover Zoom
  containerElement.addEventListener('mousemove', (e) => {
    const rect = containerElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    imageElement.style.transformOrigin = `${xPercent}% ${yPercent}%`;
    imageElement.style.transform = 'scale(2)';
  });

  containerElement.addEventListener('mouseleave', () => {
    imageElement.style.transform = 'scale(1)';
    imageElement.style.transformOrigin = 'center center';
  });

  // Mobile Lightbox
  imageElement.addEventListener('click', () => {
    // Check if mobile or if lightbox is needed
    if (window.innerWidth <= 768) {
      openLightbox(imageElement.src);
    }
  });
}

function openLightbox(imageSrc) {
  let lightbox = document.getElementById('lightbox-modal');
  
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'lightbox-modal';
    lightbox.className = 'lightbox-modal';
    
    lightbox.innerHTML = `
      <span class="lightbox-close">&times;</span>
      <div class="lightbox-content-wrapper">
        <img class="lightbox-img" id="lightbox-img" src="" alt="Zoomed view">
      </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // Lightbox CSS (inject directly to ensure it works, or place in components.css)
    const style = document.createElement('style');
    style.textContent = `
      .lightbox-modal {
        display: none;
        position: fixed;
        z-index: 2000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(45, 45, 45, 0.95);
        align-items: center;
        justify-content: center;
      }
      .lightbox-close {
        position: absolute;
        top: 20px;
        right: 30px;
        color: var(--ivory-white);
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
        z-index: 2001;
      }
      .lightbox-content-wrapper {
        max-width: 90%;
        max-height: 80%;
        overflow: auto;
      }
      .lightbox-img {
        width: 100%;
        height: auto;
        object-fit: contain;
        transition: transform 0.25s ease;
      }
    `;
    document.head.appendChild(style);

    lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
      lightbox.style.display = 'none';
      document.body.style.overflow = '';
    });

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox-content-wrapper')) {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }

  const lightboxImg = lightbox.querySelector('#lightbox-img');
  lightboxImg.src = imageSrc;
  
  lightbox.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Stop page scroll
}
