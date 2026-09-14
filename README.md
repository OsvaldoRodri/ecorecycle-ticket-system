# ecorecycle-ticket-system

Sistema de tickets de pago para proveedores de un centro de reciclaje en California. Creado a partir de una necesidad del trabajo de caja.

## Contexto

La lista de materiales y el generador de tickets se manejaban por separado, con captura duplicada. La aplicación reúne ambos pasos en una interfaz de mostrador. No se dispone de una medición documentada del ahorro de tiempo.

## Qué hace

Gestiona el flujo de pago a proveedores que traen materiales reciclables. Soporta 10 tipos de material (aluminium cans, PET, SP-PET, glass, SP-glass, HDPE, SP-HDPE, #6, #7, biometal) con precios diferenciados por tipo y calidad. Los materiales se distribuyen automáticamente entre múltiples tickets con numeración secuencial. El módulo WDS calcula cajas y CRV (California Redemption Value). El estado de la sesión persiste en `localStorage`.

## Stack

React 18, JavaScript ES6+, Vite. Sin backend, toda la lógica corre en el cliente.

## Nota sobre la arquitectura

La aplicación está actualmente en un solo componente (~1,500 líneas) organizado en secciones internas. Una mejora pendiente es separar componentes por responsabilidad y añadir pruebas de los cálculos.

## Cómo correr

```bash
git clone https://github.com/OsvaldoRodri/ecorecycle-ticket-system.git
cd ecorecycle-ticket-system
npm install
npm run dev
```
