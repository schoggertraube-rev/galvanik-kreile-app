-- Migration: Mark verified mock/test/seed orders by concrete IDs
-- Allowed values: seed, test, integration-test
-- No 'legacy', no patterns, no IS NULL

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text;

-- seed (alte Mock-/Capture-Aufträge)
UPDATE orders SET source = 'seed' WHERE id = 'raqbjkqrgs8vrmzlug3nqy6h'; -- A-207018
UPDATE orders SET source = 'seed' WHERE id = 'n1kv9p8u2r42ls2u43el95rs'; -- A-202650
UPDATE orders SET source = 'seed' WHERE id = 'okw9o7layejaw8c71a98mvpy'; -- A-204405
UPDATE orders SET source = 'seed' WHERE id = 'fq56tsymxseqdk647ab1jd8g'; -- A-2026-10002
UPDATE orders SET source = 'seed' WHERE id = 'cza8uxood3rwt910vj7iyblq'; -- A-2026-10003
UPDATE orders SET source = 'seed' WHERE id = 'to8slcrcfis8n41d14powc4y'; -- A-2026-10004

-- test (erkennbare Fantasieeingaben)
UPDATE orders SET source = 'test' WHERE id = 'bqeo6x4001r7hy2mvg6x338p'; -- A-2026-10005
UPDATE orders SET source = 'test' WHERE id = 'wj90nor53xyku8ar8lj488qw'; -- A-2026-10011
UPDATE orders SET source = 'test' WHERE id = 'arutki7938kn61nhib6xftp3'; -- A-2026-10010
UPDATE orders SET source = 'test' WHERE id = 'wsvj8f9umuhx0pet9363t737'; -- A-2026-10009
UPDATE orders SET source = 'test' WHERE id = 'u7t6gxp7rnxbom2g633rch3g'; -- A-2026-10008
UPDATE orders SET source = 'test' WHERE id = 'ovwyr33kw3jt42quwprs98f9'; -- A-2026-10000
UPDATE orders SET source = 'test' WHERE id = 'O-1781188055517';           -- A-2026-9999

-- integration-test
UPDATE orders SET source = 'integration-test' WHERE id = 'iibrx2vetlw4zetc9qrfd79z'; -- A-2026-0NaN
