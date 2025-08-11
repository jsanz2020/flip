from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import base64
import logging
import secrets

_logger = logging.getLogger(__name__)

class WebsiteFlipbook(models.Model):
    _name = 'website.flipbook'
    _description = 'PDF Flipbook for Website'
    _inherit = ['mail.thread', 'mail.activity.mixin', 'website.seo.metadata', 'website.published.mixin']
    _order = 'sequence, name'
    _check_company_auto = True

    name = fields.Char(
        string="Título del Flipbook", 
        required=True,
        tracking=True,
        help="Nombre descriptivo del flipbook que se mostrará en el sitio web"
    )
    sequence = fields.Integer(
        string="Secuencia",
        default=10,
        help="Orden de visualización"
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
        required=True
    )
    pdf_file = fields.Binary(
        string="Archivo PDF", 
        required=True,
        attachment=True,
        tracking=True,
        help="Archivo PDF que se convertirá en flipbook"
    )
    pdf_filename = fields.Char(
        string="Nombre del archivo",
        help="Nombre original del archivo PDF"
    )
    file_size = fields.Integer(
        string="Tamaño del archivo",
        compute='_compute_file_size',
        store=True,
        help="Tamaño del archivo en bytes"
    )
    description = fields.Text(
        string="Descripción",
        tracking=True,
        help="Descripción opcional del contenido del flipbook"
    )
    access_token = fields.Char(
        string="Token de Acceso",
        default=lambda self: self._generate_access_token(),
        copy=False,
        help="Token único para acceso seguro al PDF"
    )
    view_count = fields.Integer(
        string="Visualizaciones",
        default=0,
        help="Número de veces que se ha visualizado el flipbook"
    )
    last_viewed = fields.Datetime(
        string="Última visualización",
        help="Fecha y hora de la última visualización"
    )

    @api.depends('pdf_file')
    def _compute_file_size(self):
        for record in self:
            if record.pdf_file:
                try:
                    file_data = base64.b64decode(record.pdf_file)
                    record.file_size = len(file_data)
                except Exception:
                    record.file_size = 0
            else:
                record.file_size = 0

    @api.model
    def _generate_access_token(self):
        """Genera un token único para acceso seguro"""
        return secrets.token_urlsafe(32)

    @api.constrains('pdf_file')
    def _check_pdf_file(self):
        """Valida que el archivo sea realmente un PDF"""
        for record in self:
            if record.pdf_file:
                try:
                    # Decodificar el archivo para verificar el header
                    file_data = base64.b64decode(record.pdf_file)
                    if not file_data.startswith(b'%PDF'):
                        raise ValidationError(_("El archivo debe ser un PDF válido."))
                    
                    # Verificar tamaño máximo (50MB)
                    max_size = 50 * 1024 * 1024  # 50MB en bytes
                    if len(file_data) > max_size:
                        raise ValidationError(_("El archivo PDF no puede exceder 50MB."))
                        
                except Exception as e:
                    _logger.error(f"Error validando PDF: {e}")
                    raise ValidationError(_("Error al procesar el archivo PDF."))

    @api.model_create_multi
    def create(self, vals_list):
        """Override create para generar token si no existe"""
        for vals in vals_list:
            if not vals.get('access_token'):
                vals['access_token'] = self._generate_access_token()
        return super().create(vals_list)

    def regenerate_access_token(self):
        """Regenera el token de acceso"""
        for record in self:
            record.access_token = self._generate_access_token()
            record.message_post(body=_("Token de acceso regenerado"))
        return True

    def get_pdf_url(self):
        """Retorna la URL segura para acceder al PDF"""
        self.ensure_one()
        return f'/flipbook/pdf/{self.id}/{self.access_token}'

    def increment_view_count(self):
        """Incrementa el contador de visualizaciones"""
        self.ensure_one()
        self.sudo().write({
            'view_count': self.view_count + 1,
            'last_viewed': fields.Datetime.now()
        })

    def get_formatted_file_size(self):
        """Retorna el tamaño del archivo formateado"""
        self.ensure_one()
        if not self.file_size:
            return "0 B"
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

    @api.depends('name', 'pdf_filename')
    def _compute_display_name(self):
        for record in self:
            if record.pdf_filename:
                record.display_name = f"{record.name} ({record.pdf_filename})"
            else:
                record.display_name = record.name

    def action_preview_flipbook(self):
    """Abre una vista previa del flipbook en una nueva pestaña con token de acceso."""
    self.ensure_one()
    url = '/flip/%s?access_token=%s' % (self.id, self.access_token or '')
    return {
        'type': 'ir.actions.act_url',
        'url': url,
        'target': 'new',
    }
    
