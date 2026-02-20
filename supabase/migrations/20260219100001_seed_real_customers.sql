-- Sprint: Klantenpagina — Echte klanten Oranjehoen
-- Vervangt demo customers (CUS001-CUS003) met echte afnemers.
-- Append-only: oude demo-rijen worden gedeactiveerd, niet verwijderd.

UPDATE customers SET is_active = false WHERE customer_code IN ('CUS001', 'CUS002', 'CUS003');

INSERT INTO customers (customer_code, name, segment, is_active, total_revenue_ytd, last_balance_score, is_cherry_picker) VALUES
-- Genoemde klanten
('HF001',   'HelloFresh',         'meal-kit',       true, 0, NULL, false),
('ZN001',   'Zorg & Natuur',      'retail-speciaal', true, 0, NULL, false),
('PIC001',  'Picnic',             'retail-online',   true, 0, NULL, false),
('CM001',   'Cuno Moorman',       'handel',          true, 0, NULL, false),
('PVM001',  'Pieter van Meel',    'handel',          true, 0, NULL, false),
('COR001',  'Corvoet',            'foodservice',     true, 0, NULL, false),
('CRI001',  'Crisp',              'retail-online',   true, 0, NULL, false),
('GRU001',  'Grutto',             'retail-platform', true, 0, NULL, false),
('BIL001',  'Bilderberg',         'horeca',          true, 0, NULL, false);
