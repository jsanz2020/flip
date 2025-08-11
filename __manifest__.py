{
    "name": "PDF Flipbook Website",
    "version": "1.1.0",
    "summary": "Visor de PDF con efecto Flipbook para Website – Odoo 18 Community",
    "description": """
        Módulo que permite mostrar archivos PDF como flipbooks interactivos en el sitio web.
        Características:
        - Visualización de PDFs como libros animados
        - Integración completa con el editor de Website
        - Responsive y compatible con dispositivos móviles
        - Controles de navegación intuitivos
        - Seguimiento de visualizaciones y estadísticas
        - Acceso seguro mediante tokens
        - Soporte para pantalla completa
        - Optimizado para Odoo 18 Community
    """,
    "author": "Tu Nombre",
    "website": "https://www.tuwebsite.com",
    "category": "Website/Website",
    "license": "LGPL-3",
    "depends": ["website", "mail"],
    "data": [
        "security/ir.model.access.csv",    
        "views/flipbook_views.xml",        
        "views/templates.xml",
        "views/snippet.xml"
    ],
    "assets": {
        "web.assets_frontend": [
            "flip/static/src/lib/pdfjs/pdf.min.js",
            "flip/static/src/lib/pdfjs/pdf.worker.min.js", 
            "flip/static/src/lib/turnjs/turn.min.js",
            "flip/static/src/css/flipbook_styles.css",
            "flip/static/src/js/flipbook_widget.js"
        ],
        "web.assets_backend": [
            "flip/static/src/css/flipbook_backend.css"
        ]
    },
    "external_dependencies": {
        "python": []
    },
    "installable": True,
    "auto_install": False,
    "application": False,
    "post_init_hook": "post_init_hook",
    "uninstall_hook": "uninstall_hook",
}