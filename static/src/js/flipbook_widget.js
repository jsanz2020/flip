odoo.define('pdf_flipbook_website.flipbook_widget', function (require) {
    "use strict";
    const publicWidget = require('web.public.widget');

    publicWidget.registry.Flipbook = publicWidget.Widget.extend({
        selector: '.o_flipbook_wrapper',
        start: function () {
            this._super.apply(this, arguments);
            const flipbookId = this.$el.data('flipbook-id');
            if (flipbookId && flipbookId > 0) {
                this.loadPdf(`/flipbook/pdf/${flipbookId}`);
            }
        },
        async loadPdf(pdfUrl) {
            const container = this.$el.find('#flipbook');
            const pdfjsLib = window['pdfjsLib'] || window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions = { workerSrc: '/pdf_flipbook_website/static/src/lib/pdfjs/pdf.worker.min.js' };

            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: (container.width() / page.getViewport({ scale: 1 }).width) });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport }).promise;

                const img = new Image();
                img.src = canvas.toDataURL();
                container.append($('<div class="page">').append(img));
            }

            container.turn({
                width: container.width(),
                height: 500,
                autoCenter: true
            });
        }
    });

    return publicWidget.registry.Flipbook;
});
