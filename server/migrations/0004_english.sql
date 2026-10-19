-- Versi bahasa Inggris (opsional) untuk isi yang dibaca pembeli. Kosong = pakai versi Indonesia.
ALTER TABLE menu_items ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN description_en TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN portion_en TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN components_en TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN allergens_en TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN welcome_note_en TEXT NOT NULL DEFAULT '';
