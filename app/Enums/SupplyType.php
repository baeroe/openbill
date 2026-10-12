<?php

namespace App\Enums;

/** What a customer gets from us; decides the tax category for third-country customers (G goods, O services). */
enum SupplyType: string
{
    case Goods = 'goods';
    case Services = 'services';
}
