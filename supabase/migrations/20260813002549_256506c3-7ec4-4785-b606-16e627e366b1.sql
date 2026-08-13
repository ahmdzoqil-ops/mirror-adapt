CREATE TABLE public.shares (
  token TEXT PRIMARY KEY,
  edit_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE INDEX shares_created_at_idx ON public.shares (created_at DESC);