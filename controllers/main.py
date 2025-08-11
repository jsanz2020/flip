from odoo import http
from odoo.http import request
from odoo.exceptions import AccessError, UserError
from odoo.tools import file_open
import logging
import mimetypes
from werkzeug.exceptions import NotFound, Forbidden

_logger = logging.getLogger(__name__)

class FlipbookController(http.Controller):

    @http.route([
        '/flipbook/pdf/<int:flipbook_id>',
        '/flipbook/pdf/<int:flipbook_id>/<string:access_token>'
    ], type='http', auth="public", website=True, csrf=False, methods=['GET'])
    def get_flipbook_pdf(self, flipbook_id, access_token=None, **kw):
        """
        Controlador mejorado para servir PDFs con validación de acceso
        """
        try:
            # Buscar el flipbook
            domain = [
                ('id', '=', flipbook_id),
                ('is_published', '=', True)
            ]
            
            # Agregar filtro de empresa si es necesario
            if not request.env.user.has_group('base.group_system'):
                domain.append(('company_id', 'in', request.env.companies.ids))
            
            flipbook = request.env['website.flipbook'].sudo().search(domain, limit=1)
            
            if not flipbook:
                _logger.warning(f"Flipbook {flipbook_id} no encontrado o no publicado")
                raise NotFound()
            
            # Validar token de acceso si se proporciona
            if access_token and flipbook.access_token != access_token:
                _logger.warning(f"Token de acceso inválido para flipbook {flipbook_id}")
                raise Forbidden()
            
            if not flipbook.pdf_file:
                _logger.error(f"Flipbook {flipbook_id} no tiene archivo PDF")
                raise NotFound()
            
            # Incrementar contador de visualizaciones
            try:
                flipbook.increment_view_count()
            except Exception as e:
                _logger.warning(f"Error incrementando contador: {e}")
            
            # Preparar headers de respuesta
            filename = flipbook.pdf_filename or f"flipbook_{flipbook.id}.pdf"
            headers = [
                ('Content-Type', 'application/pdf'),
                ('Cache-Control', 'public, max-age=3600, immutable'),
                ('Content-Disposition', f'inline; filename="{filename}"'),
                ('X-Content-Type-Options', 'nosniff'),
                ('X-Frame-Options', 'SAMEORIGIN')
            ]
            
            # Decodificar el archivo
            try:
                import base64
                pdf_data = base64.b64decode(flipbook.pdf_file)
                return request.make_response(pdf_data, headers)
            except Exception as e:
                _logger.error(f"Error decodificando PDF {flipbook_id}: {e}")
                raise NotFound()
            
        except (NotFound, Forbidden):
            raise
        except Exception as e:
            _logger.error(f"Error sirviendo PDF {flipbook_id}: {e}")
            raise NotFound()

    @http.route('/flipbook/list', type='json', auth="public", website=True, methods=['POST'])
    def get_flipbook_list(self, **kw):
        """
        API para obtener lista de flipbooks disponibles
        """
        try:
            domain = [('is_published', '=', True)]
            
            # Filtrar por empresa si es necesario
            if not request.env.user.has_group('base.group_system'):
                domain.append(('company_id', 'in', request.env.companies.ids))
            
            flipbooks = request.env['website.flipbook'].sudo().search(domain, order='sequence, name')
            
            result = []
            for flipbook in flipbooks:
                result.append({
                    'id': flipbook.id,
                    'name': flipbook.name,
                    'description': flipbook.description or '',
                    'pdf_url': flipbook.get_pdf_url(),
                    'view_count': flipbook.view_count,
                    'file_size': flipbook.get_formatted_file_size()
                })
            
            return {'status': 'success', 'flipbooks': result}
            
        except Exception as e:
            _logger.error(f"Error obteniendo lista de flipbooks: {e}")
            return {'status': 'error', 'message': 'Error interno del servidor'}

    @http.route('/flipbook/view/<int:flipbook_id>', type='http', auth="public", website=True)
    def flipbook_view_page(self, flipbook_id, **kw):
        """
        Página dedicada para visualizar un flipbook
        """
        try:
            domain = [
                ('id', '=', flipbook_id),
                ('is_published', '=', True)
            ]
            
            if not request.env.user.has_group('base.group_system'):
                domain.append(('company_id', 'in', request.env.companies.ids))
            
            flipbook = request.env['website.flipbook'].sudo().search(domain, limit=1)
            
            if not flipbook:
                raise NotFound()
            
            values = {
                'flipbook': flipbook,
                'main_object': flipbook,
            }
            
            return request.render('flip.flipbook_page_template', values)
            
        except Exception as e:
            _logger.error(f"Error mostrando flipbook {flipbook_id}: {e}")
            raise NotFound()
