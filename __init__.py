from . import models
from . import controllers

def post_init_hook(cr, registry):
    """Hook ejecutado después de la instalación del módulo"""
    import logging
    _logger = logging.getLogger(__name__)
    _logger.info("PDF Flipbook Website: Módulo instalado correctamente")

def uninstall_hook(cr, registry):
    """Hook ejecutado antes de la desinstalación del módulo"""
    import logging
    _logger = logging.getLogger(__name__)
    _logger.info("PDF Flipbook Website: Módulo desinstalado")