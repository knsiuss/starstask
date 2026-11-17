package id.starstask.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * Security-property tests: developer/internal detail must never reach
 * user-facing copy, no matter what the backend returned.
 */
class UserFacingErrorTest {

    @Test
    fun rawRlsText_mapsToGenericSentence() {
        val message = userFacingMessage(Exception("new row violates row-level security policy for table \"assignments\""))
        assertEquals("You do not have permission to do this.", message)
        assertFalse(message.contains("assignments"))
        assertFalse(message.contains("row-level"))
    }

    @Test
    fun codes_mapToHumanSentences() {
        assertEquals("You do not have permission to do this.", userFacingMessage(Exception("PostgREST error 42501: denied")))
        assertEquals("This already exists. Refresh and try again.", userFacingMessage(Exception("duplicate key value violates unique constraint \"profiles_nim_unique\" (23505)")))
        assertEquals("Some required fields are missing or invalid. Try again.", userFacingMessage(Exception("23514")))
        assertEquals("Some required fields are missing or invalid. Try again.", userFacingMessage(Exception("22023")))
        assertEquals("This item is still in use and cannot be changed.", userFacingMessage(Exception("23503")))
        assertEquals("That item could not be found.", userFacingMessage(Exception("P0002")))
    }

    @Test
    fun networkText_mapsToConnectionSentence() {
        assertEquals("Network error. Check your connection and try again.", userFacingMessage(Exception("Failed to connect: timeout")))
        assertEquals("Network error. Check your connection and try again.", userFacingMessage(Exception("socket hang up")))
    }

    @Test
    fun unknownText_neverEchoesRawMessage() {
        val raw = "relation \"public.class_subjects\" does not exist"
        val message = userFacingMessage(Exception(raw))
        assertEquals("Something went wrong. Please try again.", message)
        assertFalse(message.contains(raw))
    }

    @Test
    fun unknownText_usesProvidedFallback() {
        assertEquals("Could not save the grade.", userFacingMessage(Exception("boom"), "Could not save the grade."))
    }

    @Test
    fun nullMessage_returnsFallback() {
        assertEquals("Could not save the event.", userFacingMessage(Exception(), "Could not save the event."))
        assertEquals("Something went wrong. Please try again.", userFacingMessage(null))
    }

    @Test
    fun securityTextWithInternalIds_neverEchoesIds() {
        val raw = "subject 11111111-2222-3333-4444-555555555555 does not belong to class 00000000-0000-0000-0000-000000000000"
        val message = userFacingMessage(Exception(raw))
        assertFalse(message.contains("11111111"))
        assertFalse(message.contains("00000000"))
    }
}
