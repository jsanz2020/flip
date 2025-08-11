/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class FlipbookWidget extends Component {
    static template = "pdf_flipbook_website.FlipbookWidget";
    
    setup() {
        this.flipbookRef = useRef("flipbook");
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            loading: true,
            error: null,
            currentPage: 1,
            totalPages: 0,
            isFullscreen: false
        });
        
        this.resizeObserver = null;
        
        onMounted(() => {
            this.initializeFlipbook();
            this.setupResizeObserver();
        });
        
        onWillUnmount(() => {
            this.cleanup();
        });
    }
    
    cleanup() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Limpiar turn.js si existe
        if (this.flipbookRef.el && window.$ && window.$.fn.turn) {
            try {
                window.$(this.flipbookRef.el).turn('destroy');
            } catch (e) {
                console.warn('Error cleaning up turn.js:', e);
            }
        }
    }
    
    setupResizeObserver() {
        if ('ResizeObserver' in window && this.flipbookRef.el) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.flipbookRef.el.parentElement);
        }
    }
    
    handleResize() {
        if (this.flipbookRef.el && window.$ && window.$.fn.turn) {
            const $container = window.$(this.flipbookRef.el);
            if ($container.turn('is')) {
                const newWidth = this.flipbookRef.el.parentElement.offsetWidth;
                const newHeight = Math.min(600, newWidth * 0.6);
                $container.turn('size', newWidth, newHeight);
            }
        }
    }

    async initializeFlipbook() {
        const flipbookId = this.props.flipbookId;
        
        if (!flipbookId || flipbookId <= 0) {
            this.state.error = "ID de flipbook inválido";
            this.state.loading = false;
            return;
        }

        try {
            await this.loadPdf(`/flipbook/pdf/${flipbookId}`);
        } catch (error) {
            console.error("Error cargando flipbook:", error);
            this.state.error = error.message || "Error cargando el flipbook";
            this.state.loading = false;
            
            if (this.notification) {
                this.notification.add("Error cargando el flipbook", {
                    type: "danger",
                    sticky: false
                });
            }
        }
    }

    async loadPdf(pdfUrl) {
        const container = this.flipbookRef.el;
        
        if (!container) {
            throw new Error("Contenedor del flipbook no encontrado");
        }

        // Verificar que PDF.js esté disponible
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
            throw new Error("PDF.js no está disponible");
        }

        // Configurar worker
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf_flipbook_website/static/src/lib/pdfjs/pdf.worker.min.js';
        }

        try {
            // Cargar el documento PDF
            const loadingTask = pdfjsLib.getDocument({
                url: pdfUrl,
                httpHeaders: {
                    'Cache-Control': 'no-cache'
                },
                withCredentials: false,
                maxImageSize: 1024 * 1024 * 10, // 10MB max por imagen
                disableFontFace: false,
                disableRange: false,
                disableStream: false
            });
            
            // Timeout de 30 segundos
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout cargando PDF')), 30000);
            });

            const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
            this.state.totalPages = pdf.numPages;

            // Limpiar contenedor
            container.innerHTML = '';

            // Calcular escala basada en el ancho del contenedor
            const containerWidth = container.parentElement.offsetWidth || 800;
            const pageWidth = Math.min(containerWidth / 2, 400); // Máximo 400px por página

            // Renderizar todas las páginas
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1 });
                    const scale = Math.min(pageWidth / viewport.width, 2); // Máximo scale 2x
                    const scaledViewport = page.getViewport({ scale });

                    // Crear canvas para la página
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = scaledViewport.height;
                    canvas.width = scaledViewport.width;
                    canvas.style.maxWidth = '100%';
                    canvas.style.height = 'auto';

                    // Renderizar página en canvas con manejo de errores
                    const renderContext = {
                        canvasContext: context,
                        viewport: scaledViewport,
                        enableWebGL: false // Desactivar WebGL para mayor compatibilidad
                    };

                    await page.render(renderContext).promise;

                    // Crear elemento de página para turn.js
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'flipbook-page';
                    pageDiv.setAttribute('data-page', pageNum);
                    pageDiv.appendChild(canvas);
                    container.appendChild(pageDiv);
                    
                } catch (pageError) {
                    console.error(`Error renderizando página ${pageNum}:`, pageError);
                    // Crear página de error
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'flipbook-page flipbook-page-error';
                    errorDiv.innerHTML = `
                        <div class="text-center p-4">
                            <i class="fa fa-exclamation-triangle fa-2x text-warning"></i>
                            <p>Error cargando página ${pageNum}</p>
                        </div>
                    `;
                    container.appendChild(errorDiv);
                }
            }

            // Inicializar turn.js
            this.initializeTurnJS(container);
            this.state.loading = false;

        } catch (error) {
            console.error("Error procesando PDF:", error);
            throw error;
        }
    }

    initializeTurnJS(container) {
        if (!window.$ || !window.$.fn.turn) {
            console.error("Turn.js no está disponible");
            this.state.error = "Librería Turn.js no disponible";
            return;
        }

        const $ = window.$;
        const $container = $(container);
        
        // Limpiar instancia anterior si existe
        if ($container.turn('is')) {
            $container.turn('destroy');
        }

        const containerWidth = container.parentElement.offsetWidth || 800;
        const containerHeight = Math.min(600, containerWidth * 0.6);

        // Configurar turn.js con opciones mejoradas
        try {
            $container.turn({
                width: containerWidth,
                height: containerHeight,
                autoCenter: true,
                duration: 800,
                gradients: true,
                acceleration: true,
                elevation: 50,
                display: containerWidth > 768 ? 'double' : 'single',
                when: {
                    turning: (event, page, view) => {
                        this.state.currentPage = page;
                        this.updatePageInfo();
                    },
                    turned: (event, page, view) => {
                        this.state.currentPage = page;
                        this.updatePageInfo();
                    },
                    start: (event, pageObject, corner) => {
                        // Opcional: agregar efectos de sonido o animaciones
                    },
                    end: (event, pageObject, turned) => {
                        // Opcional: analytics o tracking
                    }
                }
            });
        } catch (turnError) {
            console.error("Error inicializando turn.js:", turnError);
            this.state.error = "Error inicializando el visor de páginas";
            return;
        }
            autoCenter: true,
            duration: 1000,
            gradients: true,
            acceleration: true,
            elevation: 50,
            when: {
                turning: (event, page, view) => {
                    this.state.currentPage = page;
                },
                turned: (event, page, view) => {
                    this.state.currentPage = page;
                }
            }
        });

        // Agregar controles de navegación
        this.addNavigationControls($container);
        
        // Configurar eventos de teclado
        this.setupKeyboardNavigation($container);
    }
    
    setupKeyboardNavigation($container) {
        $(document).on('keydown.flipbook', (e) => {
            if (!this.state.isFullscreen) return;
            
            switch(e.keyCode) {
                case 37: // Flecha izquierda
                    e.preventDefault();
                    $container.turn('previous');
                    break;
                case 39: // Flecha derecha
                    e.preventDefault();
                    $container.turn('next');
                    break;
                case 27: // Escape
                    e.preventDefault();
                    this.exitFullscreen();
                    break;
            }
        });
    }
    
    updatePageInfo() {
        const pageInfo = this.flipbookRef.el?.parentElement?.querySelector('.flipbook-page-info');
        if (pageInfo) {
            pageInfo.querySelector('.current-page').textContent = this.state.currentPage;
            pageInfo.querySelector('.total-pages').textContent = this.state.totalPages;
        }
    }

    addNavigationControls($container) {
        const controlsHtml = `
            <div class="flipbook-controls">
                <button class="btn btn-primary flipbook-prev" title="Página anterior">
                    <i class="fa fa-chevron-left"></i>
                </button>
                <button class="btn btn-secondary flipbook-first" title="Primera página">
                    <i class="fa fa-fast-backward"></i>
                </button>
                <span class="flipbook-page-info">
                    Página <span class="current-page">${this.state.currentPage}</span> 
                    de <span class="total-pages">${this.state.totalPages}</span>
                </span>
                <button class="btn btn-secondary flipbook-last" title="Última página">
                    <i class="fa fa-fast-forward"></i>
                </button>
                <button class="btn btn-primary flipbook-next" title="Página siguiente">
                    <i class="fa fa-chevron-right"></i>
                </button>
                <button class="btn btn-info flipbook-fullscreen" title="Pantalla completa">
                    <i class="fa fa-expand"></i>
                </button>
            </div>
        `;

        $container.after(controlsHtml);

        // Eventos de navegación
        const $parent = $container.parent();
        
        $parent.find('.flipbook-prev').on('click', () => {
            $container.turn('previous');
        });

        $parent.find('.flipbook-next').on('click', () => {
            $container.turn('next');
        });
        
        $parent.find('.flipbook-first').on('click', () => {
            $container.turn('page', 1);
        });
        
        $parent.find('.flipbook-last').on('click', () => {
            $container.turn('page', this.state.totalPages);
        });
        
        $parent.find('.flipbook-fullscreen').on('click', () => {
            this.toggleFullscreen();
        });
    }
    
    toggleFullscreen() {
        if (!this.state.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }
    
    enterFullscreen() {
        const container = this.flipbookRef.el?.parentElement;
        if (container && container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                this.state.isFullscreen = true;
                container.classList.add('flipbook-fullscreen');
            }).catch(err => {
                console.warn('Error entrando en pantalla completa:', err);
            });
        }
    }
    
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                this.state.isFullscreen = false;
                const container = this.flipbookRef.el?.parentElement;
                if (container) {
                    container.classList.remove('flipbook-fullscreen');
                }
            }).catch(err => {
                console.warn('Error saliendo de pantalla completa:', err);
            });
        }
    }

    nextPage() {
        if (this.flipbookRef.el && window.$) {
            window.$(this.flipbookRef.el).turn('next');
        }
    }

    previousPage() {
        if (this.flipbookRef.el && window.$) {
            window.$(this.flipbookRef.el).turn('previous');
        }
    }
    
    goToPage(pageNumber) {
        if (this.flipbookRef.el && window.$ && pageNumber >= 1 && pageNumber <= this.state.totalPages) {
            window.$(this.flipbookRef.el).turn('page', pageNumber);
        }
    }
}

FlipbookWidget.props = {
    flipbookId: { type: Number, optional: false },
    autoStart: { type: Boolean, optional: true },
    showControls: { type: Boolean, optional: true }
};

FlipbookWidget.defaultProps = {
    autoStart: true,
    showControls: true
};

// Registrar el widget para uso público
registry.category("public_components").add("FlipbookWidget", FlipbookWidget);

// Widget legacy para compatibilidad
if (typeof odoo !== 'undefined' && odoo.define) {
    odoo.define('pdf_flipbook_website.flipbook_widget', function (require) {
        "use strict";
        
        const publicWidget = require('web.public.widget');

        publicWidget.registry.FlipbookLegacy = publicWidget.Widget.extend({
            selector: '.o_flipbook_wrapper',
            events: {
                'click .flipbook-retry': '_onRetryClick',
            },
            
            start: function () {
                this._super.apply(this, arguments);
                const flipbookId = parseInt(this.$el.data('flipbook-id'));
                
                if (flipbookId && flipbookId > 0) {
                    this.loadFlipbook(flipbookId);
                } else {
                    this.showError('ID de flipbook no válido');
                }
            },
            
            destroy: function () {
                // Limpiar eventos de teclado
                $(document).off('keydown.flipbook');
                this._super.apply(this, arguments);
            },
            
            _onRetryClick: function (ev) {
                ev.preventDefault();
                const flipbookId = parseInt(this.$el.data('flipbook-id'));
                if (flipbookId) {
                    this.loadFlipbook(flipbookId);
                }
            },

            async loadFlipbook(flipbookId) {
                try {
                    this.showLoading();
                    await this.loadPdf(`/flipbook/pdf/${flipbookId}`);
                    this.hideLoading();
                } catch (error) {
                    console.error('Error cargando flipbook:', error);
                    this.showError('Error cargando el flipbook', true);
                }
            },

            showLoading() {
                this.$el.html(`
                    <div class="flipbook-loading text-center p-4">
                        <i class="fa fa-spinner fa-spin fa-2x"></i>
                        <br>
                        <p>Cargando flipbook...</p>
                    </div>
                `);
            },

            hideLoading() {
                // El contenido se maneja en loadPdf
            },

            showError(message, showRetry = false) {
                const retryButton = showRetry ? '<button class="btn btn-primary flipbook-retry mt-2">Reintentar</button>' : '';
                this.$el.html(`
                    <div class="flipbook-error alert alert-danger text-center">
                        <i class="fa fa-exclamation-triangle fa-2x"></i>
                        <p>${message}</p>
                        ${retryButton}
                    </div>
                `);
            },

            async loadPdf(pdfUrl) {
                const container = this.$el.find('#flipbook')[0] || this.$el[0];
                
                if (!window.pdfjsLib) {
                    throw new Error('PDF.js no disponible');
                }

                const pdfjsLib = window.pdfjsLib;
                if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf_flipbook_website/static/src/lib/pdfjs/pdf.worker.min.js';
                }

                const pdf = await pdfjsLib.getDocument({
                    url: pdfUrl,
                    httpHeaders: { 'Cache-Control': 'no-cache' }
                }).promise;
                
                const containerWidth = this.$el.width() || 800;
                
                container.innerHTML = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    try {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 1 });
                        const scale = Math.min((containerWidth / 2) / viewport.width, 2);
                        const scaledViewport = page.getViewport({ scale });

                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = scaledViewport.height;
                        canvas.width = scaledViewport.width;
                        canvas.style.maxWidth = '100%';
                        canvas.style.height = 'auto';

                        await page.render({
                            canvasContext: context,
                            viewport: scaledViewport,
                            enableWebGL: false
                        }).promise;

                        const pageDiv = document.createElement('div');
                        pageDiv.className = 'flipbook-page';
                        pageDiv.setAttribute('data-page', i);
                        pageDiv.appendChild(canvas);
                        container.appendChild(pageDiv);
                        
                    } catch (pageError) {
                        console.error(`Error renderizando página ${i}:`, pageError);
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'flipbook-page flipbook-page-error';
                        errorDiv.innerHTML = `
                            <div class="text-center p-4">
                                <i class="fa fa-exclamation-triangle fa-2x text-warning"></i>
                                <p>Error cargando página ${i}</p>
                            </div>
                        `;
                        container.appendChild(errorDiv);
                    }
                }

                // Inicializar turn.js
                const $container = this.$(container);
                
                // Limpiar instancia anterior
                if ($container.turn('is')) {
                    $container.turn('destroy');
                }
                
                $container.turn({
                    width: containerWidth,
                    height: Math.min(600, containerWidth * 0.6),
                    autoCenter: true,
                    duration: 800,
                    gradients: true,
                    acceleration: true,
                    display: containerWidth > 768 ? 'double' : 'single'
                });
            }
        });

        return publicWidget.registry.FlipbookLegacy;
    });
}