package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Visitor
import com.hackathon.summer.faf.domain.repository.VisitorRepository
import com.hackathon.summer.faf.infrastructure.database.table.VisitorsTable
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.update
import org.jetbrains.exposed.sql.transactions.transaction

class PostgresVisitorRepository : VisitorRepository {

    override fun findById(id: String): Visitor? {

        return transaction {

            VisitorsTable
                .select {
                    VisitorsTable.id eq id
                }
                .map {

                    Visitor(
                        id = it[VisitorsTable.id],
                        checkedIn = it[VisitorsTable.checkedIn]
                    )
                }
                .singleOrNull()
        }
    }

    override fun markCheckedIn(id: String) {

        transaction {

            val exists = VisitorsTable
                .select {
                    VisitorsTable.id eq id
                }
                .count() > 0

            if (exists) {

                VisitorsTable.update({
                    VisitorsTable.id eq id
                }) {
                    it[checkedIn] = true
                }

            } else {

                VisitorsTable.insert {
                    it[VisitorsTable.id] = id
                    it[checkedIn] = true
                }
            }
        }
    }
}
