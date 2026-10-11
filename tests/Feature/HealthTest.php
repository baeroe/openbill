<?php

it('answers the health check with a migrated database', function () {
    $this->get('/up')->assertOk();
});
