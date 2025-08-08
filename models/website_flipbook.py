from odoo import models, fields

class WebsiteFlipbook(models.Model):
    _name = 'website.flipbook'
    _description = 'Flipbook PDF Viewer'

    name = fields.Char('Nombre del Flipbook', required=True)
    pdf_file = fields.Binary('Archivo PDF', attachment=True)
    pdf_filename = fields.Char('Nombre del Archivo')

