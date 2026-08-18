import { Injectable } from '@nestjs/common';
import type { PedidoAdminDto } from '../admin/admin.service';

// Datos reales del negocio (CLAUDE.md) — nunca inventar otros acá.
const NEGOCIO = {
  nombre: 'Pizzería Horebs',
  direccion: 'Carrera 7 # 17B - 66, Riohacha, La Guajira',
  whatsapp: '+57 315 786 1208',
};

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  tarjeta: 'Tarjeta',
};

const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Retiro en local',
  local: 'Consumo en el local',
};

function formatoPrecio(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}

function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export interface DatosCorreoFactura {
  asunto: string;
  texto: string;
  html: string;
}

function construirNombreArchivo(pedido: PedidoAdminDto): string {
  return `comprobante-${pedido.id.slice(0, 8)}.pdf`;
}

function construirDatosCorreo(pedido: PedidoAdminDto): DatosCorreoFactura {
  const nombreCliente = pedido.cliente.nombre || 'cliente';
  const idCorto = pedido.id.slice(0, 8).toUpperCase();
  const texto = `¡Hola ${nombreCliente}! Te adjuntamos el comprobante de tu pedido #${idCorto} en ${NEGOCIO.nombre}. Total: ${formatoPrecio(pedido.total)}. ¡Gracias por tu compra!`;
  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr><td style="background-color:${AZUL};padding:24px 28px;">
            <p style="margin:0;color:#FFD93D;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${NEGOCIO.nombre}</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:19px;font-weight:700;">Tu comprobante de pedido</h1>
          </td></tr>
          <tr><td style="padding:24px 28px;">
            <p style="margin:0 0 12px;font-size:14px;color:#27272a;">¡Hola ${nombreCliente}! Te dejamos adjunto el comprobante del pedido <strong>#${idCorto}</strong>.</p>
            <p style="margin:0;font-size:14px;color:#27272a;">Total: <strong style="color:${NARANJA};">${formatoPrecio(pedido.total)}</strong></p>
            <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Gracias por tu compra — ${NEGOCIO.direccion} · WhatsApp ${NEGOCIO.whatsapp}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  return { asunto: `Tu comprobante de pedido #${idCorto} — ${NEGOCIO.nombre}`, texto, html };
}

/**
 * Genera un comprobante de pedido en PDF con el diseño de marca del sitio
 * — no es una factura electrónica DIAN (no hay NIT ni resolución de
 * facturación cargados en el proyecto, así que no se inventan).
 *
 * `@react-pdf/renderer` v4 se publica solo como ESM — este proyecto
 * compila a CommonJS, así que un `import` estático rompe en runtime
 * (`ERR_REQUIRE_ESM`). Se carga con `import()` dinámico, que sí puede
 * cargar ESM desde CommonJS, y los componentes JSX se arman recién ahí
 * adentro con lo que devuelve ese import.
 */
@Injectable()
export class FacturaService {
  async generarPdf(pedido: PedidoAdminDto): Promise<Buffer> {
    const { Document, Page, Text, View, StyleSheet, renderToBuffer } = await import(
      '@react-pdf/renderer'
    );

    const styles = StyleSheet.create({
      page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#27272a' },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: AZUL,
        padding: 20,
        borderRadius: 8,
        marginBottom: 20,
      },
      negocioNombre: { color: '#ffffff', fontSize: 18, fontWeight: 700 },
      negocioDato: { color: '#e4e4e7', fontSize: 9, marginTop: 2 },
      comprobanteEtiqueta: {
        color: '#FFD93D',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
      },
      comprobanteId: { color: '#ffffff', fontSize: 13, fontWeight: 700, marginTop: 2 },
      seccion: { marginBottom: 16 },
      seccionTitulo: {
        fontSize: 8,
        fontWeight: 700,
        textTransform: 'uppercase',
        color: '#a1a1aa',
        marginBottom: 4,
        letterSpacing: 0.5,
      },
      filaDato: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
      etiqueta: { color: '#71717a' },
      valor: { color: '#27272a', fontWeight: 700 },
      tabla: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#e4e4e7' },
      filaItem: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f4f4f5',
        paddingVertical: 6,
      },
      celdaProducto: { flex: 1 },
      celdaCantidad: { width: 30, textAlign: 'center' },
      celdaPrecio: { width: 70, textAlign: 'right' },
      celdaSubtotal: { width: 70, textAlign: 'right', fontWeight: 700 },
      totalesBox: { marginTop: 12, alignItems: 'flex-end' },
      filaTotal: { flexDirection: 'row', gap: 24, marginTop: 2 },
      totalGrande: { fontSize: 15, fontWeight: 700, color: NARANJA },
      footer: {
        marginTop: 28,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e4e4e7',
        textAlign: 'center',
        color: '#a1a1aa',
        fontSize: 8,
      },
    });

    const nombreCompleto = [pedido.cliente.nombre, pedido.cliente.apellido]
      .filter(Boolean)
      .join(' ');
    const subtotal = pedido.items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);

    const documento = (
      <Document>
        <Page size="A5" style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.negocioNombre}>{NEGOCIO.nombre}</Text>
              <Text style={styles.negocioDato}>{NEGOCIO.direccion}</Text>
              <Text style={styles.negocioDato}>WhatsApp: {NEGOCIO.whatsapp}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.comprobanteEtiqueta}>Comprobante de pedido</Text>
              <Text style={styles.comprobanteId}>#{pedido.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.negocioDato}>{formatoFecha(pedido.created_at)}</Text>
            </View>
          </View>

          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Cliente</Text>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Nombre</Text>
              <Text style={styles.valor}>{nombreCompleto || '—'}</Text>
            </View>
            {pedido.cliente.telefono && (
              <View style={styles.filaDato}>
                <Text style={styles.etiqueta}>Teléfono</Text>
                <Text style={styles.valor}>{pedido.cliente.telefono}</Text>
              </View>
            )}
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Modalidad</Text>
              <Text style={styles.valor}>
                {MODALIDAD_LABEL[pedido.modalidad] ?? pedido.modalidad}
              </Text>
            </View>
            {pedido.modalidad === 'domicilio' && pedido.direccion_entrega && (
              <View style={styles.filaDato}>
                <Text style={styles.etiqueta}>Dirección de entrega</Text>
                <Text style={styles.valor}>{pedido.direccion_entrega}</Text>
              </View>
            )}
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Método de pago</Text>
              <Text style={styles.valor}>
                {METODO_PAGO_LABEL[pedido.metodo_pago] ?? pedido.metodo_pago}
              </Text>
            </View>
          </View>

          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Pedido</Text>
            <View style={styles.tabla}>
              {pedido.items.map((item, idx) => (
                <View key={idx} style={styles.filaItem}>
                  <Text style={styles.celdaProducto}>
                    {item.producto_nombre}
                    {item.variante_nombre ? ` (${item.variante_nombre})` : ''}
                  </Text>
                  <Text style={styles.celdaCantidad}>{item.cantidad}×</Text>
                  <Text style={styles.celdaPrecio}>{formatoPrecio(item.precio_unitario)}</Text>
                  <Text style={styles.celdaSubtotal}>
                    {formatoPrecio(item.precio_unitario * item.cantidad)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.totalesBox}>
              <View style={styles.filaTotal}>
                <Text style={styles.etiqueta}>Subtotal</Text>
                <Text style={styles.valor}>{formatoPrecio(subtotal)}</Text>
              </View>
              {pedido.costo_domicilio > 0 && (
                <View style={styles.filaTotal}>
                  <Text style={styles.etiqueta}>Domicilio</Text>
                  <Text style={styles.valor}>{formatoPrecio(pedido.costo_domicilio)}</Text>
                </View>
              )}
              <View style={styles.filaTotal}>
                <Text style={{ ...styles.etiqueta, fontWeight: 700 }}>Total</Text>
                <Text style={styles.totalGrande}>{formatoPrecio(pedido.total)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            {NEGOCIO.nombre} · {NEGOCIO.direccion} · Gracias por tu compra
          </Text>
        </Page>
      </Document>
    );

    return renderToBuffer(documento);
  }

  nombreArchivo(pedido: PedidoAdminDto): string {
    return construirNombreArchivo(pedido);
  }

  datosCorreo(pedido: PedidoAdminDto): DatosCorreoFactura {
    return construirDatosCorreo(pedido);
  }
}
