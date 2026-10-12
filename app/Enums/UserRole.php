<?php

namespace App\Enums;

enum UserRole: string
{
    /** Full access including users and invitations; the account from app:ensure-admin. */
    case Owner = 'owner';

    /** Everything except managing users (documents, customers, templates, fields, settings). */
    case Member = 'member';
}
