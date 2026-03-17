DO $$
BEGIN
  CREATE TYPE library_material_format AS ENUM (
    'book',
    'journal',
    'manuscript',
    'thesis',
    'dataset',
    'media',
    'archive',
    'digital_file'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE library_access_level AS ENUM ('public', 'restricted', 'confidential');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE library_item_status AS ENUM (
    'available',
    'loaned',
    'reserved',
    'maintenance',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  creator varchar(255) NOT NULL,
  description text NOT NULL DEFAULT '',
  format library_material_format NOT NULL,
  subject_code varchar(64) NOT NULL,
  subject_path text NOT NULL,
  classification_system varchar(16) NOT NULL,
  classification_code varchar(64) NOT NULL,
  isbn varchar(32),
  publisher varchar(255),
  publication_year varchar(16),
  language varchar(32) NOT NULL DEFAULT 'en',
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_level library_access_level NOT NULL DEFAULT 'public',
  item_status library_item_status NOT NULL DEFAULT 'available',
  copies_total integer NOT NULL DEFAULT 1,
  copies_available integer NOT NULL DEFAULT 1,
  shelf_location varchar(128),
  file_path text,
  mime_type varchar(128),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_name varchar(255) NOT NULL,
  borrower_email varchar(255),
  note text NOT NULL DEFAULT '',
  checked_out_at timestamp NOT NULL DEFAULT now(),
  due_at timestamp NOT NULL,
  returned_at timestamp
);

CREATE INDEX IF NOT EXISTS library_items_user_created_idx
  ON library_items (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS library_items_user_subject_idx
  ON library_items (user_id, subject_code, item_status);

CREATE INDEX IF NOT EXISTS library_items_user_title_idx
  ON library_items (user_id, title);

CREATE INDEX IF NOT EXISTS library_items_user_creator_idx
  ON library_items (user_id, creator);

CREATE INDEX IF NOT EXISTS library_loans_item_returned_idx
  ON library_loans (item_id, returned_at, due_at, id);

CREATE INDEX IF NOT EXISTS library_loans_created_checked_out_idx
  ON library_loans (created_by_user_id, checked_out_at DESC, id DESC);
