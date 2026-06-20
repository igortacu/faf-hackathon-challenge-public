package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.model.Visitor
import com.hackathon.summer.faf.domain.repository.ActivityParticipants
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.domain.repository.VisitorRepository
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityAvailabilityEvent
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityBroadcastPublisher
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ActivityBroadcastUseCaseTest {

    @Test
    fun `booking publishes full event when activity reaches capacity`() {
        val activity = Activity(
            id = "ACT001",
            name = "Beach Volleyball",
            description = "Competitive beach volleyball tournament.",
            capacity = 2,
            bookedVisitors = mutableSetOf("guest-1")
        )
        val publisher = RecordingActivityBroadcastPublisher()

        BookActivityUseCase(
            activityRepository = InMemoryActivityRepository(activity),
            visitorRepository = EmptyVisitorRepository(),
            broadcastPublisher = publisher
        ).execute("ACT001", "guest-2")

        assertEquals(
            listOf(
                ActivityAvailabilityEvent(
                    type = "beach.activity_full",
                    activityId = "ACT001",
                    activityName = "Beach Volleyball",
                    capacity = 2,
                    remaining = 0
                )
            ),
            publisher.events
        )
    }

    @Test
    fun `booking does not publish full event before capacity is reached`() {
        val activity = Activity(
            id = "ACT001",
            name = "Beach Volleyball",
            description = "Competitive beach volleyball tournament.",
            capacity = 3,
            bookedVisitors = mutableSetOf("guest-1")
        )
        val publisher = RecordingActivityBroadcastPublisher()

        BookActivityUseCase(
            activityRepository = InMemoryActivityRepository(activity),
            visitorRepository = EmptyVisitorRepository(),
            broadcastPublisher = publisher
        ).execute("ACT001", "guest-2")

        assertTrue(publisher.events.isEmpty())
    }

    @Test
    fun `cancellation publishes available event when a full activity gains space`() {
        val activity = Activity(
            id = "ACT001",
            name = "Beach Volleyball",
            description = "Competitive beach volleyball tournament.",
            capacity = 2,
            bookedVisitors = mutableSetOf("guest-1", "guest-2")
        )
        val publisher = RecordingActivityBroadcastPublisher()

        CancelActivityUseCase(
            activityRepository = InMemoryActivityRepository(activity),
            broadcastPublisher = publisher
        ).execute("ACT001", "guest-2")

        assertEquals(
            listOf(
                ActivityAvailabilityEvent(
                    type = "beach.activity_available",
                    activityId = "ACT001",
                    activityName = "Beach Volleyball",
                    capacity = 2,
                    remaining = 1
                )
            ),
            publisher.events
        )
    }

    @Test
    fun `cancellation does not publish available event when activity was not full`() {
        val activity = Activity(
            id = "ACT001",
            name = "Beach Volleyball",
            description = "Competitive beach volleyball tournament.",
            capacity = 3,
            bookedVisitors = mutableSetOf("guest-1", "guest-2")
        )
        val publisher = RecordingActivityBroadcastPublisher()

        CancelActivityUseCase(
            activityRepository = InMemoryActivityRepository(activity),
            broadcastPublisher = publisher
        ).execute("ACT001", "guest-2")

        assertTrue(publisher.events.isEmpty())
    }
}

private class InMemoryActivityRepository(
    private val activity: Activity
) : ActivityRepository {
    override fun findAll(): List<Activity> = listOf(activity)

    override fun findById(id: String): Activity? =
        activity.takeIf { it.id == id }

    override fun findParticipantsByActivityId(id: String): ActivityParticipants? =
        activity.takeIf { it.id == id }?.let {
            ActivityParticipants(
                activityId = it.id,
                capacity = it.capacity,
                participants = it.bookedVisitors.toList()
            )
        }

    override fun save(activity: Activity) = Unit

    override fun create(activity: Activity): Boolean = false

    override fun delete(id: String): Boolean = false
}

private class EmptyVisitorRepository : VisitorRepository {
    // Booking now requires the visitor to exist and be checked in, so the
    // broadcast tests provide a checked-in visitor for any id.
    override fun findById(id: String): Visitor? = Visitor(id = id, checkedIn = true)

    override fun markCheckedIn(id: String) = Unit
}

private class RecordingActivityBroadcastPublisher : ActivityBroadcastPublisher {
    val events = mutableListOf<ActivityAvailabilityEvent>()

    override fun publishActivityFull(activity: Activity) {
        events.add(
            ActivityAvailabilityEvent(
                type = "beach.activity_full",
                activityId = activity.id,
                activityName = activity.name,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        )
    }

    override fun publishActivityAvailable(activity: Activity) {
        events.add(
            ActivityAvailabilityEvent(
                type = "beach.activity_available",
                activityId = activity.id,
                activityName = activity.name,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        )
    }
}
