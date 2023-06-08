package io.mojaloop.centralledger.jmeter.rest.client.json.testdata;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Transfer;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

@Data
@Getter
@Setter
public class TestDataCarrier extends ABaseJSONObject {
	private ABaseJSONObject request;
	private ABaseJSONObject response;
	private ActionType actionType;

	public enum ActionType {
		create_participant,
		transfer_prepare,
		transfer_fulfil,
		transfer_reject,
		transfer_prepare_fulfil,
		transfer_lookup,
		account_lookup
	}

	public static class JSONMapping {
		public static final String REQUEST = "request";
		public static final String RESPONSE = "response";
		public static final String ACTION_TYPE = "actionType";
	}

	/**
	 * Populates local variables with {@code jsonObject}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TestDataCarrier(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.ACTION_TYPE)) {
			this.setActionType(ActionType.valueOf(jsonObject.getString(JSONMapping.ACTION_TYPE)));
			switch (this.getActionType()) {
				case transfer_fulfil:
				case transfer_prepare:
				case transfer_prepare_fulfil:
				case transfer_lookup:
					if (!jsonObject.isNull(JSONMapping.REQUEST)) {
						this.setRequest(new Transfer(jsonObject.getJSONObject(JSONMapping.REQUEST)));
					}
					if (!jsonObject.isNull(JSONMapping.RESPONSE)) {
						this.setResponse(new Transfer(jsonObject.getJSONObject(JSONMapping.RESPONSE)));
					}
				break;
				case create_participant:
				case account_lookup:
					if (!jsonObject.isNull(JSONMapping.REQUEST)) {
						this.setRequest(new Participant(jsonObject.getJSONObject(JSONMapping.REQUEST)));
					}
					if (!jsonObject.isNull(JSONMapping.RESPONSE)) {
						this.setResponse(new Participant(jsonObject.getJSONObject(JSONMapping.RESPONSE)));
					}
				break;
			}
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getActionType() == null) returnVal.put(JSONMapping.ACTION_TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.ACTION_TYPE, this.getActionType().name());

		if (this.getRequest() == null) returnVal.put(JSONMapping.REQUEST, JSONObject.NULL);
		else returnVal.put(JSONMapping.REQUEST, this.getRequest().toJsonObject());

		if (this.getResponse() == null) returnVal.put(JSONMapping.RESPONSE, JSONObject.NULL);
		else returnVal.put(JSONMapping.RESPONSE, this.getResponse().toJsonObject());

		return returnVal;
	}
}
