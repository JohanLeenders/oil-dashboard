-- Fix: Voeg 'dij_anatomisch' toe aan product_category enum.
-- OH-DIJANA-001 was foutief geseeded als 'karkas', waardoor het als
-- WHOLE_BIRD behandeld werd en orders van de griller werden afgetrokken.
-- Dij anatomisch is het hele achterkwart (zadel/bout) — een eigen categorie.

ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'dij_anatomisch';
