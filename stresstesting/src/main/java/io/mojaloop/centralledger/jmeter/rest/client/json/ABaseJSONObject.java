package io.mojaloop.centralledger.jmeter.rest.client.json;

import lombok.Getter;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.Serializable;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 *
 * @see JSONObject
 */
public abstract class ABaseJSONObject implements Serializable {
	public static final String DATE_AND_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";//2022-01-17T12:12:18.425Z

	public static final long serialVersionUID = 1L;

	@Getter
	protected JSONObject JSONObject;

	/**
	 * The JSON mapping for the {@code ABaseFluidJSONObject} object.
	 */
	public static class JSONMapping {

	}

	protected Date dateFrom(JSONObject jsonObject, String tagName) {
		if (jsonObject.isNull(tagName)) return null;

		String date = jsonObject.getString(tagName);
		if (date == null || date.trim().isEmpty()) return null;
		if (date.startsWith("\"") && date.endsWith("\"")) date = date.substring(1, date.length() - 1);
		try {
			return new SimpleDateFormat(DATE_AND_TIME_FORMAT).parse(date);
		} catch (ParseException nfe) {
			nfe.printStackTrace();
			return null;
		}
	}

	/**
	 * Default constructor.
	 */
	public ABaseJSONObject() {
		super();
	}

	/**
	 * Populates local variables Id and Service Ticket with {@code jsonObjectParam}.
	 *
	 * @param jsonObjectParam The JSON Object.
	 */
	public ABaseJSONObject(JSONObject jsonObjectParam) {
		this();

		this.JSONObject = jsonObjectParam;
		if (this.JSONObject == null) return;
	}

	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = new JSONObject();

		return returnVal;
	}

	/**
	 * Return the Text representation of {@code this} object.
	 *
	 * @return JSON body of {@code this} object.
	 */
	@Override
	public String toString() {
		JSONObject jsonObject = this.toJsonObject();
		return (jsonObject == null) ? null : jsonObject.toString();
	}
}
