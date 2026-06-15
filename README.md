# ecorecycle-ticket-system

Sistema de tickets de pago para proveedores de un centro de reciclaje en California. En uso activo en producción.

## Contexto

El proceso anterior era manual: calculadora, Excel, notas en papel. El tiempo promedio por operación era de 15 minutos. Con este sistema bajó a 3 minutos.

## Qué hace

Gestiona el flujo de pago a proveedores que traen materiales reciclables. Soporta 10 tipos de material (aluminium cans, PET, SP-PET, glass, SP-glass, HDPE, SP-HDPE, #6, #7, biometal) con precios diferenciados por tipo y calidad. Los materiales se distribuyen automáticamente entre múltiples tickets con numeración secuencial. El módulo WDS calcula cajas y CRV (California Redemption Value). El estado de la sesión persiste en `localStorage`.

## Stack

React 18, JavaScript ES6+, Vite. Sin backend, toda la lógica corre en el cliente.

## Nota sobre la arquitectura

La aplicación está actualmente en un solo componente (~1,500 líneas) organizado en secciones internas. La siguiente versión refactorizará a componentes separados por responsabilidad.

## Cómo correr

```bash
git clone https://github.com/OsvaldoRodri/ecorecycle-ticket-system.git
cd ecorecycle-ticket-system
npm install
npm run dev
```
