-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema central_ledger
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `central_ledger` ;

-- -----------------------------------------------------
-- Schema central_ledger
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `central_ledger` DEFAULT CHARACTER SET utf8mb4 ;
USE `central_ledger` ;

-- -----------------------------------------------------
-- Table `central_ledger`.`contactType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`contactType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`contactType` (
  `contactTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`contactTypeId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `contacttype_name_unique` ON `central_ledger`.`contactType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`currency`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`currency` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`currency` (
  `currencyId` VARCHAR(3) NOT NULL,
  `name` VARCHAR(128) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`currencyId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`endpointType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`endpointType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`endpointType` (
  `endpointTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`endpointTypeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 6;

CREATE UNIQUE INDEX `endpointtype_name_unique` ON `central_ledger`.`endpointType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`event`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`event` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`event` (
  `eventId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`eventId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`transferDuplicateCheck`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferDuplicateCheck` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferDuplicateCheck` (
  `transferId` VARCHAR(36) NOT NULL,
  `hash` VARCHAR(256) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`transfer`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transfer` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transfer` (
  `transferId` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `currencyId` VARCHAR(3) NOT NULL,
  `ilpCondition` VARCHAR(256) NOT NULL,
  `expirationDate` DATETIME NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferId`),
  CONSTRAINT `transfer_currencyid_foreign`
    FOREIGN KEY (`currencyId`)
    REFERENCES `central_ledger`.`currency` (`currencyId`),
  CONSTRAINT `transfer_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transferDuplicateCheck` (`transferId`))
ENGINE = InnoDB;

CREATE INDEX `transfer_currencyid_index` ON `central_ledger`.`transfer` (`currencyId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`ilpPacket`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`ilpPacket` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`ilpPacket` (
  `transferId` VARCHAR(36) NOT NULL,
  `value` TEXT NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferId`),
  CONSTRAINT `ilppacket_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`ledgerAccountType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`ledgerAccountType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`ledgerAccountType` (
  `ledgerAccountTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledgerAccountTypeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 4;

CREATE UNIQUE INDEX `ledgeraccounttype_name_unique` ON `central_ledger`.`ledgerAccountType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`ledgerEntryType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`ledgerEntryType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`ledgerEntryType` (
  `ledgerEntryTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledgerEntryTypeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 11;

CREATE UNIQUE INDEX `ledgerentrytype_name_unique` ON `central_ledger`.`ledgerEntryType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`migration`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`migration` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`migration` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NULL DEFAULT NULL,
  `batch` INT(11) NULL DEFAULT NULL,
  `migration_time` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 71;


-- -----------------------------------------------------
-- Table `central_ledger`.`migration_lock`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`migration_lock` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`migration_lock` (
  `index` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `is_locked` INT(11) NULL DEFAULT NULL,
  PRIMARY KEY (`index`))
ENGINE = InnoDB
AUTO_INCREMENT = 2;


-- -----------------------------------------------------
-- Table `central_ledger`.`participant`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participant` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participant` (
  `participantId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(256) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`participantId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `participant_name_unique` ON `central_ledger`.`participant` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantContact`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantContact` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantContact` (
  `participantContactId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantId` INT(10) UNSIGNED NOT NULL,
  `contactTypeId` INT(10) UNSIGNED NOT NULL,
  `value` VARCHAR(256) NOT NULL,
  `priorityPreference` INT(11) NOT NULL DEFAULT '9',
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`participantContactId`),
  CONSTRAINT `participantcontact_contacttypeid_foreign`
    FOREIGN KEY (`contactTypeId`)
    REFERENCES `central_ledger`.`contactType` (`contactTypeId`),
  CONSTRAINT `participantcontact_participantid_foreign`
    FOREIGN KEY (`participantId`)
    REFERENCES `central_ledger`.`participant` (`participantId`))
ENGINE = InnoDB;

CREATE INDEX `participantcontact_participantid_index` ON `central_ledger`.`participantContact` (`participantId` ASC);

CREATE INDEX `participantcontact_contacttypeid_index` ON `central_ledger`.`participantContact` (`contactTypeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantCurrency`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantCurrency` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantCurrency` (
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantId` INT(10) UNSIGNED NOT NULL,
  `currencyId` VARCHAR(3) NOT NULL,
  `ledgerAccountTypeId` INT(10) UNSIGNED NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`participantCurrencyId`),
  CONSTRAINT `participantcurrency_currencyid_foreign`
    FOREIGN KEY (`currencyId`)
    REFERENCES `central_ledger`.`currency` (`currencyId`),
  CONSTRAINT `participantcurrency_ledgeraccounttypeid_foreign`
    FOREIGN KEY (`ledgerAccountTypeId`)
    REFERENCES `central_ledger`.`ledgerAccountType` (`ledgerAccountTypeId`),
  CONSTRAINT `participantcurrency_participantid_foreign`
    FOREIGN KEY (`participantId`)
    REFERENCES `central_ledger`.`participant` (`participantId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `participantcurrency_pcl_unique` ON `central_ledger`.`participantCurrency` (`participantId` ASC, `currencyId` ASC, `ledgerAccountTypeId` ASC);

CREATE INDEX `participantcurrency_ledgeraccounttypeid_foreign` ON `central_ledger`.`participantCurrency` (`ledgerAccountTypeId` ASC);

CREATE INDEX `participantcurrency_participantid_index` ON `central_ledger`.`participantCurrency` (`participantId` ASC);

CREATE INDEX `participantcurrency_currencyid_index` ON `central_ledger`.`participantCurrency` (`currencyId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantEndpoint`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantEndpoint` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantEndpoint` (
  `participantEndpointId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantId` INT(10) UNSIGNED NOT NULL,
  `endpointTypeId` INT(10) UNSIGNED NOT NULL,
  `value` VARCHAR(512) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`participantEndpointId`),
  CONSTRAINT `participantendpoint_endpointtypeid_foreign`
    FOREIGN KEY (`endpointTypeId`)
    REFERENCES `central_ledger`.`endpointType` (`endpointTypeId`),
  CONSTRAINT `participantendpoint_participantid_foreign`
    FOREIGN KEY (`participantId`)
    REFERENCES `central_ledger`.`participant` (`participantId`))
ENGINE = InnoDB;

CREATE INDEX `participantendpoint_participantid_index` ON `central_ledger`.`participantEndpoint` (`participantId` ASC);

CREATE INDEX `participantendpoint_endpointtypeid_index` ON `central_ledger`.`participantEndpoint` (`endpointTypeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantLimitType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantLimitType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantLimitType` (
  `participantLimitTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`participantLimitTypeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 2;

CREATE UNIQUE INDEX `participantlimittype_name_unique` ON `central_ledger`.`participantLimitType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantPosition`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantPosition` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantPosition` (
  `participantPositionId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL,
  `value` DECIMAL(18,2) NOT NULL,
  `reservedValue` DECIMAL(18,2) NOT NULL,
  `changedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`participantPositionId`),
  CONSTRAINT `participantposition_participantcurrencyid_foreign`
    FOREIGN KEY (`participantCurrencyId`)
    REFERENCES `central_ledger`.`participantCurrency` (`participantCurrencyId`))
ENGINE = InnoDB;

CREATE INDEX `participantposition_participantcurrencyid_index` ON `central_ledger`.`participantPosition` (`participantCurrencyId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferState`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferState` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferState` (
  `transferStateId` VARCHAR(50) NOT NULL,
  `enumeration` VARCHAR(50) NOT NULL COMMENT 'transferState associated to the Mojaloop API',
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferStateId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`transferStateChange`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferStateChange` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferStateChange` (
  `transferStateChangeId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `transferId` VARCHAR(36) NOT NULL,
  `transferStateId` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferStateChangeId`),
  CONSTRAINT `transferstatechange_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`),
  CONSTRAINT `transferstatechange_transferstateid_foreign`
    FOREIGN KEY (`transferStateId`)
    REFERENCES `central_ledger`.`transferState` (`transferStateId`))
ENGINE = InnoDB;

CREATE INDEX `transferstatechange_transferid_index` ON `central_ledger`.`transferStateChange` (`transferId` ASC);

CREATE INDEX `transferstatechange_transferstateid_index` ON `central_ledger`.`transferStateChange` (`transferStateId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantPositionChange`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantPositionChange` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantPositionChange` (
  `participantPositionChangeId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantPositionId` BIGINT(20) UNSIGNED NOT NULL,
  `transferStateChangeId` BIGINT(20) UNSIGNED NOT NULL,
  `value` DECIMAL(18,2) NOT NULL,
  `reservedValue` DECIMAL(18,2) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`participantPositionChangeId`),
  CONSTRAINT `participantpositionchange_participantpositionid_foreign`
    FOREIGN KEY (`participantPositionId`)
    REFERENCES `central_ledger`.`participantPosition` (`participantPositionId`),
  CONSTRAINT `participantpositionchange_transferstatechangeid_foreign`
    FOREIGN KEY (`transferStateChangeId`)
    REFERENCES `central_ledger`.`transferStateChange` (`transferStateChangeId`))
ENGINE = InnoDB;

CREATE INDEX `participantpositionchange_participantpositionid_index` ON `central_ledger`.`participantPositionChange` (`participantPositionId` ASC);

CREATE INDEX `participantpositionchange_transferstatechangeid_index` ON `central_ledger`.`participantPositionChange` (`transferStateChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantLimit`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantLimit` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantLimit` (
  `participantLimitId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL,
  `participantLimitTypeId` INT(10) UNSIGNED NOT NULL,
  `value` DECIMAL(18,2) NOT NULL DEFAULT '0.00',
  `thresholdAlarmPercentage` DECIMAL(5,2) NOT NULL DEFAULT '10.00',
  `startAfterParticipantPositionChangeId` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`participantLimitId`),
  CONSTRAINT `participantlimit_participantcurrencyid_foreign`
    FOREIGN KEY (`participantCurrencyId`)
    REFERENCES `central_ledger`.`participantCurrency` (`participantCurrencyId`),
  CONSTRAINT `participantlimit_participantlimittypeid_foreign`
    FOREIGN KEY (`participantLimitTypeId`)
    REFERENCES `central_ledger`.`participantLimitType` (`participantLimitTypeId`),
  CONSTRAINT `participantlimit_startafterparticipantpositionchangeid_foreign`
    FOREIGN KEY (`startAfterParticipantPositionChangeId`)
    REFERENCES `central_ledger`.`participantPositionChange` (`participantPositionChangeId`))
ENGINE = InnoDB;

CREATE INDEX `participantlimit_participantcurrencyid_index` ON `central_ledger`.`participantLimit` (`participantCurrencyId` ASC);

CREATE INDEX `participantlimit_participantlimittypeid_index` ON `central_ledger`.`participantLimit` (`participantLimitTypeId` ASC);

CREATE INDEX `participantlimit_startafterparticipantpositionchangeid_index` ON `central_ledger`.`participantLimit` (`startAfterParticipantPositionChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`participantParty`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`participantParty` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`participantParty` (
  `participantPartyId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantId` INT(10) UNSIGNED NOT NULL,
  `partyId` BIGINT(20) UNSIGNED NOT NULL,
  PRIMARY KEY (`participantPartyId`),
  CONSTRAINT `participantparty_participantid_foreign`
    FOREIGN KEY (`participantId`)
    REFERENCES `central_ledger`.`participant` (`participantId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `participantparty_participantid_partyid_unique` ON `central_ledger`.`participantParty` (`participantId` ASC, `partyId` ASC);

CREATE INDEX `participantparty_participantid_index` ON `central_ledger`.`participantParty` (`participantId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`segment`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`segment` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`segment` (
  `segmentId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `segmentType` VARCHAR(50) NOT NULL,
  `enumeration` INT(11) NOT NULL DEFAULT '0',
  `tableName` VARCHAR(50) NOT NULL,
  `value` BIGINT(20) NOT NULL,
  `changedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`segmentId`))
ENGINE = InnoDB;

CREATE INDEX `segment_keys_index` ON `central_ledger`.`segment` (`segmentType` ASC, `enumeration` ASC, `tableName` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementState`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementState` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementState` (
  `settlementStateId` VARCHAR(50) NOT NULL,
  `enumeration` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementStateId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementStateChange`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementStateChange` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementStateChange` (
  `settlementStateChangeId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementId` BIGINT(20) UNSIGNED NOT NULL,
  `settlementStateId` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementStateChangeId`),
  CONSTRAINT `settlementstatechange_settlementid_foreign`
    FOREIGN KEY (`settlementId`)
    REFERENCES `central_ledger`.`settlement` (`settlementId`),
  CONSTRAINT `settlementstatechange_settlementstateid_foreign`
    FOREIGN KEY (`settlementStateId`)
    REFERENCES `central_ledger`.`settlementState` (`settlementStateId`))
ENGINE = InnoDB;

CREATE INDEX `settlementstatechange_settlementid_index` ON `central_ledger`.`settlementStateChange` (`settlementId` ASC);

CREATE INDEX `settlementstatechange_settlementstateid_index` ON `central_ledger`.`settlementStateChange` (`settlementStateId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlement`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlement` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlement` (
  `settlementId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currentStateChangeId` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`settlementId`),
  CONSTRAINT `settlement_currentstatechangeid_foreign`
    FOREIGN KEY (`currentStateChangeId`)
    REFERENCES `central_ledger`.`settlementStateChange` (`settlementStateChangeId`))
ENGINE = InnoDB;

CREATE INDEX `settlement_currentstatechangeid_foreign` ON `central_ledger`.`settlement` (`currentStateChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementParticipantCurrencyStateChange`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementParticipantCurrencyStateChange` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementParticipantCurrencyStateChange` (
  `settlementParticipantCurrencyStateChangeId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementParticipantCurrencyId` BIGINT(20) UNSIGNED NOT NULL,
  `settlementStateId` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementParticipantCurrencyStateChangeId`),
  CONSTRAINT `spcsc_settlementparticipantcurrencyid_foreign`
    FOREIGN KEY (`settlementParticipantCurrencyId`)
    REFERENCES `central_ledger`.`settlementParticipantCurrency` (`settlementParticipantCurrencyId`),
  CONSTRAINT `spcsc_settlementstateid_foreign`
    FOREIGN KEY (`settlementStateId`)
    REFERENCES `central_ledger`.`settlementState` (`settlementStateId`))
ENGINE = InnoDB;

CREATE INDEX `spcsc_settlementparticipantcurrencyid_index` ON `central_ledger`.`settlementParticipantCurrencyStateChange` (`settlementParticipantCurrencyId` ASC);

CREATE INDEX `spcsc_settlementstateid_index` ON `central_ledger`.`settlementParticipantCurrencyStateChange` (`settlementStateId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementParticipantCurrency`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementParticipantCurrency` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementParticipantCurrency` (
  `settlementParticipantCurrencyId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementId` BIGINT(20) UNSIGNED NOT NULL,
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL,
  `netAmount` DECIMAL(18,2) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currentStateChangeId` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
  `settlementTransferId` VARCHAR(36) NULL DEFAULT NULL,
  PRIMARY KEY (`settlementParticipantCurrencyId`),
  CONSTRAINT `settlementparticipantcurrency_participantcurrencyid_foreign`
    FOREIGN KEY (`participantCurrencyId`)
    REFERENCES `central_ledger`.`participantCurrency` (`participantCurrencyId`),
  CONSTRAINT `settlementparticipantcurrency_settlementid_foreign`
    FOREIGN KEY (`settlementId`)
    REFERENCES `central_ledger`.`settlement` (`settlementId`),
  CONSTRAINT `spc_currentstatechangeid_foreign`
    FOREIGN KEY (`currentStateChangeId`)
    REFERENCES `central_ledger`.`settlementParticipantCurrencyStateChange` (`settlementParticipantCurrencyStateChangeId`))
ENGINE = InnoDB;

CREATE INDEX `settlementparticipantcurrency_settlementid_index` ON `central_ledger`.`settlementParticipantCurrency` (`settlementId` ASC);

CREATE INDEX `settlementparticipantcurrency_participantcurrencyid_index` ON `central_ledger`.`settlementParticipantCurrency` (`participantCurrencyId` ASC);

CREATE INDEX `settlementparticipantcurrency_settlementtransferid_index` ON `central_ledger`.`settlementParticipantCurrency` (`settlementTransferId` ASC);

CREATE INDEX `spc_currentstatechangeid_foreign` ON `central_ledger`.`settlementParticipantCurrency` (`currentStateChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementWindowState`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementWindowState` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementWindowState` (
  `settlementWindowStateId` VARCHAR(50) NOT NULL,
  `enumeration` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementWindowStateId`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementWindowStateChange`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementWindowStateChange` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementWindowStateChange` (
  `settlementWindowStateChangeId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementWindowId` BIGINT(20) UNSIGNED NOT NULL,
  `settlementWindowStateId` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementWindowStateChangeId`),
  CONSTRAINT `settlementwindowstatechange_settlementwindowid_foreign`
    FOREIGN KEY (`settlementWindowId`)
    REFERENCES `central_ledger`.`settlementWindow` (`settlementWindowId`),
  CONSTRAINT `settlementwindowstatechange_settlementwindowstateid_foreign`
    FOREIGN KEY (`settlementWindowStateId`)
    REFERENCES `central_ledger`.`settlementWindowState` (`settlementWindowStateId`))
ENGINE = InnoDB
AUTO_INCREMENT = 2;

CREATE INDEX `settlementwindowstatechange_settlementwindowid_index` ON `central_ledger`.`settlementWindowStateChange` (`settlementWindowId` ASC);

CREATE INDEX `settlementwindowstatechange_settlementwindowstateid_index` ON `central_ledger`.`settlementWindowStateChange` (`settlementWindowStateId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementWindow`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementWindow` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementWindow` (
  `settlementWindowId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `reason` VARCHAR(512) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currentStateChangeId` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`settlementWindowId`),
  CONSTRAINT `settlementwindow_currentstatechangeid_foreign`
    FOREIGN KEY (`currentStateChangeId`)
    REFERENCES `central_ledger`.`settlementWindowStateChange` (`settlementWindowStateChangeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 2;

CREATE INDEX `settlementwindow_currentstatechangeid_foreign` ON `central_ledger`.`settlementWindow` (`currentStateChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementSettlementWindow`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementSettlementWindow` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementSettlementWindow` (
  `settlementSettlementWindowId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementId` BIGINT(20) UNSIGNED NOT NULL,
  `settlementWindowId` BIGINT(20) UNSIGNED NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementSettlementWindowId`),
  CONSTRAINT `settlementsettlementwindow_settlementid_foreign`
    FOREIGN KEY (`settlementId`)
    REFERENCES `central_ledger`.`settlement` (`settlementId`),
  CONSTRAINT `settlementsettlementwindow_settlementwindowid_foreign`
    FOREIGN KEY (`settlementWindowId`)
    REFERENCES `central_ledger`.`settlementWindow` (`settlementWindowId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `settlementsettlementwindow_unique` ON `central_ledger`.`settlementSettlementWindow` (`settlementId` ASC, `settlementWindowId` ASC);

CREATE INDEX `settlementsettlementwindow_settlementid_index` ON `central_ledger`.`settlementSettlementWindow` (`settlementId` ASC);

CREATE INDEX `settlementsettlementwindow_settlementwindowid_index` ON `central_ledger`.`settlementSettlementWindow` (`settlementWindowId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferParticipantRoleType`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferParticipantRoleType` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferParticipantRoleType` (
  `transferParticipantRoleTypeId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(512) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferParticipantRoleTypeId`))
ENGINE = InnoDB
AUTO_INCREMENT = 6;

CREATE UNIQUE INDEX `transferparticipantroletype_name_unique` ON `central_ledger`.`transferParticipantRoleType` (`name` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`settlementTransferParticipant`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`settlementTransferParticipant` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`settlementTransferParticipant` (
  `settlementTransferParticipantId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlementId` BIGINT(20) UNSIGNED NOT NULL,
  `settlementWindowId` BIGINT(20) UNSIGNED NOT NULL,
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL,
  `transferParticipantRoleTypeId` INT(10) UNSIGNED NOT NULL,
  `ledgerEntryTypeId` INT(10) UNSIGNED NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlementTransferParticipantId`),
  CONSTRAINT `settlementtransferparticipant_ledgerentrytypeid_foreign`
    FOREIGN KEY (`ledgerEntryTypeId`)
    REFERENCES `central_ledger`.`ledgerEntryType` (`ledgerEntryTypeId`),
  CONSTRAINT `settlementtransferparticipant_participantcurrencyid_foreign`
    FOREIGN KEY (`participantCurrencyId`)
    REFERENCES `central_ledger`.`participantCurrency` (`participantCurrencyId`),
  CONSTRAINT `settlementtransferparticipant_settlementid_foreign`
    FOREIGN KEY (`settlementId`)
    REFERENCES `central_ledger`.`settlement` (`settlementId`),
  CONSTRAINT `settlementtransferparticipant_settlementwindowid_foreign`
    FOREIGN KEY (`settlementWindowId`)
    REFERENCES `central_ledger`.`settlementWindow` (`settlementWindowId`),
  CONSTRAINT `stp_transferparticipantroletypeid_foreign`
    FOREIGN KEY (`transferParticipantRoleTypeId`)
    REFERENCES `central_ledger`.`transferParticipantRoleType` (`transferParticipantRoleTypeId`))
ENGINE = InnoDB;

CREATE INDEX `settlementtransferparticipant_settlementid_index` ON `central_ledger`.`settlementTransferParticipant` (`settlementId` ASC);

CREATE INDEX `settlementtransferparticipant_settlementwindowid_index` ON `central_ledger`.`settlementTransferParticipant` (`settlementWindowId` ASC);

CREATE INDEX `settlementtransferparticipant_participantcurrencyid_index` ON `central_ledger`.`settlementTransferParticipant` (`participantCurrencyId` ASC);

CREATE INDEX `stp_transferparticipantroletypeid_index` ON `central_ledger`.`settlementTransferParticipant` (`transferParticipantRoleTypeId` ASC);

CREATE INDEX `settlementtransferparticipant_ledgerentrytypeid_index` ON `central_ledger`.`settlementTransferParticipant` (`ledgerEntryTypeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`token`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`token` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`token` (
  `tokenId` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `participantId` INT(10) UNSIGNED NOT NULL,
  `value` VARCHAR(256) NOT NULL,
  `expiration` BIGINT(20) NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tokenId`),
  CONSTRAINT `token_participantid_foreign`
    FOREIGN KEY (`participantId`)
    REFERENCES `central_ledger`.`participant` (`participantId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `token_value_unique` ON `central_ledger`.`token` (`value` ASC);

CREATE INDEX `token_participantid_index` ON `central_ledger`.`token` (`participantId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferError`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferError` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferError` (
  `transferErrorId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `transferStateChangeId` BIGINT(20) UNSIGNED NOT NULL,
  `errorCode` INT(10) UNSIGNED NOT NULL,
  `errorDescription` VARCHAR(128) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferErrorId`),
  CONSTRAINT `transfererror_transferstatechangeid_foreign`
    FOREIGN KEY (`transferStateChangeId`)
    REFERENCES `central_ledger`.`transferStateChange` (`transferStateChangeId`))
ENGINE = InnoDB;

CREATE INDEX `transfererror_transferstatechangeid_index` ON `central_ledger`.`transferError` (`transferStateChangeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferFulfilment`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferFulfilment` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferFulfilment` (
  `transferFulfilmentId` VARCHAR(36) NOT NULL,
  `transferId` VARCHAR(36) NOT NULL,
  `ilpFulfilment` VARCHAR(256) NOT NULL,
  `completedDate` DATETIME NOT NULL,
  `isValid` TINYINT(1) NULL DEFAULT NULL,
  `settlementWindowId` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferFulfilmentId`),
  CONSTRAINT `transferfulfilment_settlementwindowid_foreign`
    FOREIGN KEY (`settlementWindowId`)
    REFERENCES `central_ledger`.`settlementWindow` (`settlementWindowId`),
  CONSTRAINT `transferfulfilment_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `transferfulfilment_transferid_ilpfulfilment_unique` ON `central_ledger`.`transferFulfilment` (`transferId` ASC, `ilpFulfilment` ASC);

CREATE INDEX `transferfulfilment_transferid_index` ON `central_ledger`.`transferFulfilment` (`transferId` ASC);

CREATE INDEX `transferfulfilment_settlementwindowid_index` ON `central_ledger`.`transferFulfilment` (`settlementWindowId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferExtension`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferExtension` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferExtension` (
  `transferExtensionId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `transferId` VARCHAR(36) NOT NULL,
  `transferFulfilmentId` VARCHAR(36) NULL DEFAULT NULL,
  `key` VARCHAR(128) NOT NULL,
  `value` TEXT NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferExtensionId`),
  CONSTRAINT `transferextension_transferfulfilmentid_foreign`
    FOREIGN KEY (`transferFulfilmentId`)
    REFERENCES `central_ledger`.`transferFulfilment` (`transferFulfilmentId`),
  CONSTRAINT `transferextension_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`))
ENGINE = InnoDB;

CREATE INDEX `transferextension_transferid_index` ON `central_ledger`.`transferExtension` (`transferId` ASC);

CREATE INDEX `transferextension_transferfulfilmentid_index` ON `central_ledger`.`transferExtension` (`transferFulfilmentId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferFulfilmentDuplicateCheck`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferFulfilmentDuplicateCheck` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferFulfilmentDuplicateCheck` (
  `transferFulfilmentId` VARCHAR(36) NOT NULL,
  `transferId` VARCHAR(36) NOT NULL,
  `hash` VARCHAR(256) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferFulfilmentId`),
  CONSTRAINT `transferfulfilmentduplicatecheck_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`))
ENGINE = InnoDB;

CREATE INDEX `transferfulfilmentduplicatecheck_transferid_index` ON `central_ledger`.`transferFulfilmentDuplicateCheck` (`transferId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferParticipant`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferParticipant` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferParticipant` (
  `transferParticipantId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `transferId` VARCHAR(36) NOT NULL,
  `participantCurrencyId` INT(10) UNSIGNED NOT NULL,
  `transferParticipantRoleTypeId` INT(10) UNSIGNED NOT NULL,
  `ledgerEntryTypeId` INT(10) UNSIGNED NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferParticipantId`),
  CONSTRAINT `transferparticipant_ledgerentrytypeid_foreign`
    FOREIGN KEY (`ledgerEntryTypeId`)
    REFERENCES `central_ledger`.`ledgerEntryType` (`ledgerEntryTypeId`),
  CONSTRAINT `transferparticipant_participantcurrencyid_foreign`
    FOREIGN KEY (`participantCurrencyId`)
    REFERENCES `central_ledger`.`participantCurrency` (`participantCurrencyId`),
  CONSTRAINT `transferparticipant_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`),
  CONSTRAINT `transferparticipant_transferparticipantroletypeid_foreign`
    FOREIGN KEY (`transferParticipantRoleTypeId`)
    REFERENCES `central_ledger`.`transferParticipantRoleType` (`transferParticipantRoleTypeId`))
ENGINE = InnoDB;

CREATE INDEX `transferparticipant_transferid_index` ON `central_ledger`.`transferParticipant` (`transferId` ASC);

CREATE INDEX `transferparticipant_participantcurrencyid_index` ON `central_ledger`.`transferParticipant` (`participantCurrencyId` ASC);

CREATE INDEX `transferparticipant_transferparticipantroletypeid_index` ON `central_ledger`.`transferParticipant` (`transferParticipantRoleTypeId` ASC);

CREATE INDEX `transferparticipant_ledgerentrytypeid_index` ON `central_ledger`.`transferParticipant` (`ledgerEntryTypeId` ASC);


-- -----------------------------------------------------
-- Table `central_ledger`.`transferTimeout`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `central_ledger`.`transferTimeout` ;

CREATE TABLE IF NOT EXISTS `central_ledger`.`transferTimeout` (
  `transferTimeoutId` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `transferId` VARCHAR(36) NOT NULL,
  `expirationDate` DATETIME NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferTimeoutId`),
  CONSTRAINT `transfertimeout_transferid_foreign`
    FOREIGN KEY (`transferId`)
    REFERENCES `central_ledger`.`transfer` (`transferId`))
ENGINE = InnoDB;

CREATE UNIQUE INDEX `transfertimeout_transferid_unique` ON `central_ledger`.`transferTimeout` (`transferId` ASC);


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
