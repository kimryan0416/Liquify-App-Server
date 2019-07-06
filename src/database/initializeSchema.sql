CREATE TABLE IF NOT EXISTS `Users` (
	`id` VARCHAR(255) NOT NULL, 
    `email` VARCHAR(100) NOT NULL, 
    `password` VARCHAR(100) NOT NULL, 
    `legal_name` VARCHAR(100) NOT NULL,
    `date_created` VARCHAR(255),
	`valid` BOOLEAN DEFAULT false,
    PRIMARY KEY (`id`), 
    UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE, 
    UNIQUE INDEX `email_UNIQUE` (`email` ASC) VISIBLE, 
    UNIQUE INDEX `password_UNIQUE` (`password` ASC) VISIBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Verification_Hashes` (
	`id` VARCHAR(255) NOT NULL,
    `hash` VARCHAR(255) NOT NULL,
    INDEX `user_id` (`id`),
    FOREIGN KEY (`id`)
		REFERENCES `Users`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `User_Sessions` (
	`user_id` VARCHAR(255) NOT NULL,
	`session_id` VARCHAR(255) NOT NULL, 
    `fingerprint` VARCHAR(255) NOT NULL, 
    `date_created` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`session_id`), 
    UNIQUE INDEX `session_id_UNIQUE` (`session_id` ASC) VISIBLE, 
    UNIQUE INDEX `fingerprint_UNIQUE` (`fingerprint` ASC) VISIBLE,
    FOREIGN KEY (`user_id`)
		REFERENCES `Users`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `Users` (`id`, `email`, `password`, `legal_name`)
	VALUES ('123456', 'kimryan0416@gmail.com', '$2b$10$HYNK1FuUUvWb2sNC3INtueu52ISggAfFTLOKXP62YxR6LvKj1CP6G', 'Test User');
INSERT IGNORE INTO `Verification_Hashes` (`id`, `hash`) 
	VALUES ('123456','$2b$10$ml82CjaJ2rUE06YdZY5fueREOKA0GDbZs1gC6Dtafv6sW9uu/mtfG');