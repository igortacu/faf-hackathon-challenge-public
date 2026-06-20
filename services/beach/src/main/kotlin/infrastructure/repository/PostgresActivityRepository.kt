package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.database.table.ActivityTable
import com.hackathon.summer.faf.infrastructure.database.table.BookingsTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class PostgresActivityRepository : ActivityRepository {

    override fun findAll(): List<Activity> {

        return transaction {

            val bookingsByActivity = BookingsTable
                .selectAll()
                .groupBy({ it[BookingsTable.activityId] }, { it[BookingsTable.visitorId] })

            ActivityTable.selectAll().map {

                val activityId = it[ActivityTable.id]

                Activity(
                    id = activityId,
                    name = it[ActivityTable.name],
                    description = it[ActivityTable.description],
                    capacity = it[ActivityTable.capacity],
                    bookedVisitors = bookingsByActivity[activityId]
                        ?.toMutableSet()
                        ?: mutableSetOf()
                )
            }
        }
    }

    override fun findById(id: String): Activity? {

        return transaction {

            val row = ActivityTable
                .select { ActivityTable.id eq id }
                .singleOrNull()
                ?: return@transaction null

            val bookedVisitors = BookingsTable
                .select { BookingsTable.activityId eq id }
                .map { it[BookingsTable.visitorId] }
                .toMutableSet()

            Activity(
                id = row[ActivityTable.id],
                name = row[ActivityTable.name],
                description = row[ActivityTable.description],
                capacity = row[ActivityTable.capacity],
                bookedVisitors = bookedVisitors
            )
        }
    }

    override fun save(activity: Activity) {

        transaction {

            val exists =
                ActivityTable.select {
                    ActivityTable.id eq activity.id
                }.count() > 0

            if (exists) {

                ActivityTable.update({
                    ActivityTable.id eq activity.id
                }) {

                    it[name] = activity.name
                    it[description] = activity.description
                    it[capacity] = activity.capacity
                }

            } else {

                ActivityTable.insert {

                    it[id] = activity.id
                    it[name] = activity.name
                    it[description] = activity.description
                    it[capacity] = activity.capacity
                }
            }

            // Replace the persisted booking set with the model's current state.
            BookingsTable.deleteWhere { BookingsTable.activityId eq activity.id }

            activity.bookedVisitors.forEach { visitor ->
                BookingsTable.insert {
                    it[activityId] = activity.id
                    it[visitorId] = visitor
                }
            }
        }
    }
}
