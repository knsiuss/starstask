package id.starstask.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure-logic parity tests for the profile module — same codes/limits as
 * web `becomeClassRepresentative` and `profileSettingsSchema`.
 */
class ProfileLogicTest {

    @Test
    fun claim_granted_isSuccess() {
        val outcome = mapClaimCode("granted")
        assertTrue(outcome.succeeded)
    }

    @Test
    fun claim_alreadyRepresentative_isSuccess() {
        val outcome = mapClaimCode("already_representative")
        assertTrue(outcome.succeeded)
    }

    @Test
    fun claim_limitReached_isFailure() {
        val outcome = mapClaimCode("limit_reached")
        assertFalse(outcome.succeeded)
        assertEquals("This class already has 5 class representatives.", outcome.message)
    }

    @Test
    fun claim_notMember_isFailure() {
        val outcome = mapClaimCode("not_member")
        assertFalse(outcome.succeeded)
        assertEquals("Join the class before becoming its representative.", outcome.message)
    }

    @Test
    fun claim_classInactive_isFailure() {
        val outcome = mapClaimCode("class_inactive")
        assertFalse(outcome.succeeded)
        assertEquals("This class is no longer active.", outcome.message)
    }

    @Test
    fun claim_unknownCode_isFailure() {
        assertFalse(mapClaimCode(null).succeeded)
        assertFalse(mapClaimCode("something_else").succeeded)
    }

    @Test
    fun validation_acceptsInRangeValues() {
        val errors = validateProfileSettings("P Kanisius Bagaskara", "bagas", "IM ELON MUSK")
        assertTrue(errors.isEmpty())
    }

    @Test
    fun validation_rejectsShortNameAndNickname() {
        val errors = validateProfileSettings("A", "x", "")
        assertEquals("Full name must be at least 2 characters", errors["fullName"])
        assertEquals("Nickname must be at least 2 characters", errors["nickname"])
    }

    @Test
    fun validation_rejectsOverMaxNameAndNickname() {
        val errors = validateProfileSettings("a".repeat(81), "b".repeat(61), "")
        assertEquals("Full name must be 80 characters or fewer", errors["fullName"])
        assertEquals("Nickname must be 60 characters or fewer", errors["nickname"])
    }

    @Test
    fun validation_rejectsOverMaxBioAndAllowsEmptyBio() {
        val errors = validateProfileSettings("Ab", "cd", "x".repeat(281))
        assertEquals("Bio must be 280 characters or fewer", errors["bio"])
        val emptyBio = validateProfileSettings("Ab", "cd", "")
        assertFalse(emptyBio.containsKey("bio"))
    }
}
