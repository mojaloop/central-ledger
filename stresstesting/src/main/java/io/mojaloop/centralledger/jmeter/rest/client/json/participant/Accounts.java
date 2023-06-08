package io.mojaloop.centralledger.jmeter.rest.client.json.participant;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

/**
 */
@Getter
@Setter
public class Accounts extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private List<Account> accounts;

	public static class JSONMapping {

	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Accounts(JSONObject jsonObject) {
		super(jsonObject);

	}

	/**
	 *
	 * @return
	 * @throws JSONException
	 */
	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		return returnVal;
	}
}
