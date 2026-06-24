package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.infrastructure.database.table.VisitorsTable
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

class PostgresVisitorRepositoryTest {

    private val repository = PostgresVisitorRepository()

    @BeforeTest
    fun setUp() {
        Database.connect(
            url = "jdbc:h2:mem:beach-visitors;DB_CLOSE_DELAY=-1;",
            driver = "org.h2.Driver"
        )

        transaction {
            SchemaUtils.create(VisitorsTable)
            VisitorsTable.deleteAll()
        }
    }

    @Test
    fun `markCheckedIn creates checked in visitor when visitor does not exist`() {
        repository.markCheckedIn("guest-123")

        assertEquals(true, repository.findById("guest-123")?.checkedIn)
    }

    @Test
    fun `markCheckedIn keeps existing visitor checked in`() {
        repository.markCheckedIn("guest-123")
        repository.markCheckedIn("guest-123")

        assertEquals(true, repository.findById("guest-123")?.checkedIn)
    }
}
