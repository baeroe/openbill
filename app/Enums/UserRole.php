<?php

namespace App\Enums;

enum UserRole: string
{
    /** Full access including users and settings; the account from app:ensure-admin. */
    case Owner = 'owner';

    /** Works with documents and customers. */
    case Member = 'member';
}
