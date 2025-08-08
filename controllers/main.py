# controllers/main.py
from odoo import http
from odoo.http import request

class FlipbookController(http.Controller):

    @http.route('/get_flipbook_pdf/<int:flipbook_id>', type='http', auth="public", website=True)
    def get_flipbook_pdf(self, flipbook_id, **kw):
        flipbook = request.env['website.flipbook'].sudo().browse(flipbook_id)
        if not flipbook or not flipbook.pdf_file:
            return request.not_found()
        
        # Devuelve el contenido del PDF directamente
        return request.make_response(
            flipbook.pdf_file,
            [('Content-Type', 'application/pdf')]
        )

