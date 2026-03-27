package models

import (
	"gorm.io/gorm"
)

type URL struct {
	gorm.Model
	TargetURL string `gorm:"unique;not null" json:"target_url"`
}
