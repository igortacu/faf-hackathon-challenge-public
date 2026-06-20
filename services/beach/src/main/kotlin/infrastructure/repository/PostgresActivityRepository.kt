package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.repository.ActivityParticipants
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.database.table.ActivityBookingsTable
import com.hackathon.summer.faf.infrastructure.database.table.ActivityTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class PostgresActivityRepository : ActivityRepository {

    override fun findAll(): List<Activity> {

        return transaction {

            ActivityTable.selectAll().map {

                toActivity(it)
            }
        }
    }

    override fun findById(id: String): Activity? {

        return transaction {

            ActivityTable
                .select { ActivityTable.id eq id }
                .map {

                    toActivity(it)
                }
                .singleOrNull()
        }
    }

    override fun findParticipantsByActivityId(id: String): ActivityParticipants? {

        return transaction {

            ActivityTable
                .select { ActivityTable.id eq id }
                .map {
                    ActivityParticipants(
                        activityId = it[ActivityTable.id],
                        capacity = it[ActivityTable.capacity],
                        participants = findBookedVisitors(it[ActivityTable.id])
                    )
                }
                .singleOrNull()
        }
    }

    override fun isVisitorBooked(visitorId: String): Boolean {

        return transaction {

            ActivityBookingsTable
                .select { ActivityBookingsTable.visitorId eq visitorId }
                .count() > 0
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
            ActivityBookingsTable.deleteWhere {
                ActivityBookingsTable.activityId eq activity.id
            }

            activity.bookedVisitors.forEach { visitorId ->
                ActivityBookingsTable.insert {
                    it[activityId] = activity.id
                    it[ActivityBookingsTable.visitorId] = visitorId
                }
            }
        }
    }

    override fun create(activity: Activity): Boolean {

        return transaction {

            val exists =
                ActivityTable.select {
                    ActivityTable.id eq activity.id
                }.count() > 0

            if (exists) {
                false
            } else {
                ActivityTable.insert {

                    it[id] = activity.id
                    it[name] = activity.name
                    it[description] = activity.description
                    it[capacity] = activity.capacity
                }
                true
            }
        }
    }

    override fun delete(id: String): Boolean {

        return transaction {
            val deletedRows = ActivityTable.deleteWhere {
                SqlExpressionBuilder.run { ActivityTable.id eq id }
            }
            deletedRows > 0
        }
    }

    private fun toActivity(row: ResultRow): Activity {

        val activityId = row[ActivityTable.id]

        return Activity(
            id = activityId,
            name = row[ActivityTable.name],
            description = row[ActivityTable.description],
            capacity = row[ActivityTable.capacity],
            bookedVisitors = findBookedVisitors(activityId).toMutableSet()
        )
    }

    private fun findBookedVisitors(activityId: String): List<String> {

        return ActivityBookingsTable
            .select { ActivityBookingsTable.activityId eq activityId }
            .map { it[ActivityBookingsTable.visitorId] }
            .sorted()
    }
}
