-- Execute once before enabling the controlled OAuth start routes.
-- SHA-256 digests only; raw nonces stay in HttpOnly browser cookies.
CREATE TABLE IF NOT EXISTS gateway_oauth_nonces (
  nonce_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  provider VARCHAR(16) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gateway_oauth_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional maintenance, e.g. nightly:
-- DELETE FROM gateway_oauth_nonces WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY);
