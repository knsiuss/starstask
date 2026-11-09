package id.starstask.mobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.CheckInResult
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.DashboardAssignment
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.SessionRow
import id.starstask.mobile.data.loadClassMembers
import id.starstask.mobile.data.loadSessionById

// Route content for HomeScreen (detail screens). Extracted to keep HomeScreen <300 lines.
// Returns true if a route was handled (caller should return).

enum class HomeRoute {
    CLASS_DETAIL,
    ASSIGNMENT_DETAIL,
    SESSION_DETAIL,
    SUBMIT_ASSIGNMENT,
    NEW_SESSION,
    SCHEDULE,
    LEAVE_DETAIL,
    NOTIFICATION_DETAIL,
    HOME,
}

@Composable
fun HomeRouteContent(
    route: HomeRoute,
    selectedClass: DashboardClass?,
    selectedAssignment: DashboardAssignment?,
    selectedSession: SessionRow?,
    selectedLeave: LeaveRequest?,
    selectedNotification: NotificationRow?,
    classMembers: List<String>,
    onClassMembersChange: (List<String>) -> Unit,
    userId: String,
    academicCard: id.starstask.mobile.data.AcademicCard?,
    onCheckIn: (String) -> Unit,
    onBackHome: () -> Unit,
    onOpenSession: (String, (SessionRow?) -> Unit) -> Unit,
    onOpenClass: (String) -> Unit = {},
): Boolean {
    when (route) {
        HomeRoute.CLASS_DETAIL -> {
            val clazz = selectedClass
            if (clazz != null) {
                LaunchedEffect(clazz.id) { onClassMembersChange(loadClassMembers(clazz.id)) }
                ClassDetailScreen(
                    clazz = ClassDetail(
                        id = clazz.id,
                        name = clazz.name,
                        slug = clazz.slug,
                        semester = clazz.semester,
                        academicYear = clazz.academicYear,
                        memberCount = classMembers.size,
                        isAdmin = clazz.isAdmin,
                    ),
                    members = classMembers,
                    userId = userId,
                    onBack = onBackHome,
                )
            }
            return true
        }
        HomeRoute.ASSIGNMENT_DETAIL -> {
            val assignment = selectedAssignment
            if (assignment != null) {
                AssignmentDetailScreen(
                    userId = userId,
                    assignment = Assignment(
                        id = assignment.id,
                        title = assignment.title,
                        status = "published",
                        deadline = assignment.deadline,
                        className = assignment.subjectName,
                    ),
                    onBack = onBackHome,
                )
            }
            return true
        }
        HomeRoute.SESSION_DETAIL -> {
            val session = selectedSession
            if (session != null) {
                SessionDetailScreen(session = session, onBack = onBackHome, onCheckIn = onCheckIn)
            }
            return true
        }
        HomeRoute.SUBMIT_ASSIGNMENT -> {
            SubmitAssignmentScreen(userId = userId, onBack = onBackHome, onSubmitted = onBackHome)
            return true
        }
        HomeRoute.NEW_SESSION -> {
            NewSessionScreen(userId = userId, onBack = onBackHome, onCreated = onBackHome)
            return true
        }
        HomeRoute.SCHEDULE -> {
            id.starstask.mobile.ui.screens.ScheduleScreen(userId = userId)
            return true
        }
        HomeRoute.LEAVE_DETAIL -> {
            return true
        }
        HomeRoute.NOTIFICATION_DETAIL -> {
            val notification = selectedNotification
            if (notification != null) {
                NotificationDetailScreen(notification = notification, onBack = onBackHome)
            }
            return true
        }
        HomeRoute.HOME -> return false
    }
}
