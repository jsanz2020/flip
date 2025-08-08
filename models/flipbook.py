# models/flipbook.py
from odoo import models, fields

class WebsiteFlipbook(models.Model):
    _name = 'website.flipbook'
    _description = 'PDF Flipbook for Website'

    name = fields.Char(string="Título", required=True)
    pdf_file = fields.Binary(string="Archivo PDF", required=True)
    pdf_filename = fields.Char(string="Nombre del archivo") # Odoo lo llena automáticamente
