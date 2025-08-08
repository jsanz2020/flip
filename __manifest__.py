{
    "name": "PDF Flipbook Website",
    "version": "1.0",
    "summary": "Visor de PDF con efecto Flipbook para Website – Odoo 18 Community",
    "author": "Tu Nombre",
    "category": "Website",
    "depends": ["website"],
    "data": [
        "views/flipbook_views.xml",        ← Asegura que el modelo ya existe
        "security/ir.model.access.csv",    ← Ahora el CSV puede encontrar el modelo
        "views/assets.xml",
        "views/templates.xml",
        "views/snippet.xml"
            ],
    "assets": {
        "web.assets_frontend": [
            "/pdf_flipbook_website/static/src/lib/pdfjs/pdf.min.js",
            "/pdf_flipbook_website/static/src/lib/pdfjs/pdf.worker.min.js",
            "/pdf_flipbook_website/static/src/lib/turnjs/turn.min.js",
            "/pdf_flipbook_website/static/src/css/flipbook_styles.css",
            "/pdf_flipbook_website/static/src/js/flipbook_widget.js"
        ]
    },
    "license": "LGPL-3"
}
