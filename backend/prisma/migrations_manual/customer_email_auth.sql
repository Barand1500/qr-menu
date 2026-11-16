-- MySQL 8 / MariaDB. Run before deploying the new backend; existing customers are preserved.
SET @customer_auth_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_musteriler' AND COLUMN_NAME = 'auth_version') = 0,
  'ALTER TABLE `menu_musteriler` ADD COLUMN `auth_version` INTEGER NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE customer_auth_stmt FROM @customer_auth_ddl;
EXECUTE customer_auth_stmt;
DEALLOCATE PREPARE customer_auth_stmt;

CREATE TABLE IF NOT EXISTS `customer_email_challenges` (
  `email` VARCHAR(150) NOT NULL,
  `id` VARCHAR(36) NOT NULL,
  `purpose` VARCHAR(12) NOT NULL,
  `codeHash` CHAR(64) NULL,
  `grantHash` CHAR(64) NULL,
  `customerVersion` INTEGER NULL,
  `customerId` INTEGER NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `grantExpiresAt` DATETIME(3) NULL,
  `resendAt` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `windowStart` DATETIME(3) NOT NULL,
  `sent` INTEGER NOT NULL DEFAULT 0,
  `version` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`email`), UNIQUE KEY `customer_email_challenges_id_key` (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
