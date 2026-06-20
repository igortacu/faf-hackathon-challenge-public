package com.hackathon.summer.faf.infrastructure.database.table

import org.jetbrains.exposed.sql.ReferenceOption
import org.jetbrains.exposed.sql.Table

object ActivityBookingsTable : Table("activity_bookings") {

    val activityId = varchar("activity_id", 50)
        .references(ActivityTable.id, onDelete = ReferenceOption.CASCADE)

    val visitorId = varchar("visitor_id", 50)

    override val primaryKey = PrimaryKey(activityId, visitorId)
}
