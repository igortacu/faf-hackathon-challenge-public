package com.hackathon.summer.faf.infrastructure.database.table

import org.jetbrains.exposed.sql.Table

// Persists the guest-to-activity booking relationship so bookings survive
// across requests. The composite primary key also enforces that a visitor
// cannot be booked into the same activity twice.
object BookingsTable : Table("bookings") {

    val activityId = varchar("activity_id", 50)

    val visitorId = varchar("visitor_id", 50)

    override val primaryKey = PrimaryKey(activityId, visitorId)
}
