package io.mojaloop.centralledger.jmeter.rest.client;

import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Accounts;
import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Transfer;
import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

/**
 *
 */
public class DFSPClient extends ABaseRESTClient {

	public DFSPClient(String endpointBaseUrl) {
		super(endpointBaseUrl);
	}

	/**
	 *
	 */
	public Accounts getHubAccounts(String participantName) {
		return new Accounts(this.getJson(
				String.format("/participants/%s/accounts", participantName)));
	}

	/**
	 * @see Participant
	 */
	public List<Participant> getAllParticipants() {
		JSONArray array = this.getJsonArray("/participants", null);
		List<Participant> returnVal = new ArrayList<>();
		for (int index = 0;index < array.length();index++) {
			returnVal.add(new Participant(array.getJSONObject(index)));
		}
		return returnVal;
	}

	public Participant jMeterCreateParticipant(Participant toCreate) {
		return new Participant(this.postJson(toCreate, "/jmeter/participants/create"));
	}

	/**
	 * @see Participant
	 */
	public Participant getParticipant(String name) {
		return new Participant(this.getJson(String.format("/participants/%s", name)));
	}

	public Transfer jMeterTransferPrepare(Transfer transfer) {
		return new Transfer(this.postJson(transfer, "/jmeter/transfers/prepare"));
	}

	public Transfer jMeterTransferLookup(String participant, String transferId) {
		String lookupUri = String.format("/jmeter/participants/%s/transfers/%s", participant, transferId);
		return new Transfer(this.getJson(lookupUri));
	}
}
