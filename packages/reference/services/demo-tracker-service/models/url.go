package models

import (
	"gorm.io/gorm"
)

type URL struct {
	gorm.Model
	UserID    string `gorm:"index;not null"`
	TargetURL string `gorm:"uniqueIndex:idx_user_url;not null"`
}
