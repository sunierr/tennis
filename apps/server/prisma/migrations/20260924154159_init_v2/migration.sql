-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account` VARCHAR(64) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(20) NOT NULL,
    `levelTenths` INTEGER NULL,
    `city` VARCHAR(32) NULL,
    `district` VARCHAR(32) NULL,
    `bio` VARCHAR(140) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_account_key`(`account`),
    INDEX `User_city_levelTenths_idx`(`city`, `levelTenths`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(60) NOT NULL,
    `city` VARCHAR(32) NOT NULL,
    `venue` VARCHAR(80) NOT NULL,
    `venueAddress` VARCHAR(160) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 120,
    `fee` DECIMAL(10, 2) NULL,
    `feeType` ENUM('TREAT', 'AA', 'OTHER') NOT NULL DEFAULT 'AA',
    `format` ENUM('SINGLES', 'DOUBLES', 'TRAINING') NOT NULL DEFAULT 'DOUBLES',
    `capacity` INTEGER NOT NULL,
    `surface` ENUM('HARD', 'CLAY', 'GRASS', 'INDOOR') NOT NULL DEFAULT 'HARD',
    `levelMinTenths` INTEGER NOT NULL,
    `levelMaxTenths` INTEGER NOT NULL,
    `beginnerFriendly` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(400) NULL,
    `status` ENUM('OPEN', 'CANCELLED', 'FINISHED') NOT NULL DEFAULT 'OPEN',
    `creatorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MatchPost_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `MatchPost_city_status_startsAt_idx`(`city`, `status`, `startsAt`),
    INDEX `MatchPost_levelMinTenths_levelMaxTenths_idx`(`levelMinTenths`, `levelMaxTenths`),
    INDEX `MatchPost_creatorId_startsAt_idx`(`creatorId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchParticipant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matchId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('JOINED', 'CANCELLED') NOT NULL DEFAULT 'JOINED',
    `note` VARCHAR(100) NULL,
    `levelAtJoinTenths` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,

    INDEX `MatchParticipant_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `MatchParticipant_matchId_status_idx`(`matchId`, `status`),
    UNIQUE INDEX `MatchParticipant_matchId_userId_key`(`matchId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MatchPost` ADD CONSTRAINT `MatchPost_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchParticipant` ADD CONSTRAINT `MatchParticipant_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `MatchPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchParticipant` ADD CONSTRAINT `MatchParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
