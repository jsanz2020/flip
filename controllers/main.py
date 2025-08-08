from odoo import http
from odoo.http import request
import base64

class FlipbookController(http.Controller):

    @http.route(['/flipbook/pdf/<int:flipbook_id>'], type='http', auth="public")
    def serve_pdf(self, flipbook_id):
        record = request.env['website.flipbook'].sudo().browse(flipbook_id)
        if not record.exists() or not record.pdf_file:
            return request.not_found()
        pdf = base64.b64decode(record.pdf_file)
        return request.make_response(pdf, headers=[
            ('Content-Type', 'application/pdf'),
            ('Content-Disposition', f'inline; filename="{record.pdf_filename or "flipbook.pdf"}"')
        ])
